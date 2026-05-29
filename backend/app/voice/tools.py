import os
from dataclasses import dataclass
from datetime import UTC, datetime
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams

from app.database import (
    complete_step_and_activate_next,
    count_completed_steps,
    load_session_payload,
    save_ai_intervention,
    save_evidence_item,
    save_structured_observation,
    set_session_status,
    set_step_status,
)
from app.routes.sessions import InspectionStep, SessionResponse
from app.services.ai_stub import structure_observation
from app.services.engine_check import (
    engine_answers_to_transcript,
    engine_issue_summary,
    structure_engine_answer_options,
    structure_engine_answers,
)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
ENGINE_ANSWER_KEYS = ("knocking", "rattling", "idleVibration", "exhaustSound")


@dataclass(frozen=True)
class PendingPhotoReview:
    image_bytes: bytes
    mime_type: str
    source_uri: str | None = None


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _evidence_root() -> Path:
    return Path(
        os.environ.get(
            "JOCKEY_COPILOT_EVIDENCE_DIR",
            str(BACKEND_ROOT / ".local" / "evidence"),
        )
    )


def _photo_object_key(session_id: str, step_id: str) -> str:
    return f"sessions/{session_id}/photos/{step_id}.jpg"


def _load_session(session_id: str) -> SessionResponse:
    payload = load_session_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")
    return SessionResponse.model_validate(payload)


def _active_step(session: SessionResponse) -> InspectionStep | None:
    return next(
        (
            step
            for step in session.plan.steps
            if step.status in {"active", "needs_observation"}
        ),
        None,
    )


def _session_step(session: SessionResponse, step_id: str | None) -> InspectionStep:
    step = (
        _active_step(session)
        if step_id is None
        else next((step for step in session.plan.steps if step.id == step_id), None)
    )
    if step is None:
        raise HTTPException(status_code=404, detail="Inspection step not found")
    return step


def _next_step(session: SessionResponse, step_id: str | None) -> dict[str, Any] | None:
    if step_id is None:
        return None
    step = next((step for step in session.plan.steps if step.id == step_id), None)
    return None if step is None else step.model_dump(by_alias=True)


def _normalize_parts(parts: Any) -> list[str]:
    if not isinstance(parts, list):
        return []
    return [str(part).strip() for part in parts if str(part).strip()]


def accept_photo_evidence(
    *,
    session_id: str,
    step_id: str,
    pending_photo: PendingPhotoReview,
    guidance: str | None = None,
    visible_parts: list[str] | None = None,
) -> dict[str, Any]:
    session = _load_session(session_id)
    step = _session_step(session, step_id)
    if step.kind != "photo":
        raise HTTPException(
            status_code=422,
            detail="Photo evidence can only be accepted for photo steps",
        )
    if not pending_photo.image_bytes:
        raise HTTPException(status_code=422, detail="Captured photo is empty")
    if not pending_photo.mime_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Captured evidence must be an image")

    object_key = _photo_object_key(session_id, step.id)
    destination = _evidence_root() / object_key
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(pending_photo.image_bytes)

    now = _utc_now()
    evidence_id = f"ev_{uuid4().hex[:12]}"
    metadata: dict[str, Any] = {
        "imageBytes": len(pending_photo.image_bytes),
        "imageMimeType": pending_photo.mime_type,
        "source": "saarthi-realtime-photo-review",
        "visibleParts": visible_parts or [],
    }
    if pending_photo.source_uri:
        metadata["sourceUri"] = pending_photo.source_uri

    save_evidence_item(
        evidence_id=evidence_id,
        session_id=session_id,
        step_id=step.id,
        kind="photo",
        object_key=object_key,
        local_uri=str(destination),
        quality_score=0.93,
        accepted=True,
        metadata=metadata,
        created_at=now,
    )

    if step.id == "lhs-front-door":
        set_step_status(session_id, step.id, "needs_observation", now)
        updated_session = _load_session(session_id)
        return {
            "type": "photo_acceptance",
            "accepted": True,
            "evidenceId": evidence_id,
            "completedStepId": step.id,
            "nextStep": None,
            "message": (
                "I see a possible mark near the door handle. Is it a scratch, "
                "dent, rust, or dirt?"
            ),
            "session": updated_session.model_dump(by_alias=True),
        }

    next_step_id = complete_step_and_activate_next(session_id, step.id, now)
    updated_session = _load_session(session_id)
    return {
        "type": "photo_acceptance",
        "accepted": True,
        "evidenceId": evidence_id,
        "completedStepId": step.id,
        "nextStep": _next_step(updated_session, next_step_id),
        "message": guidance.strip()
        if guidance and guidance.strip()
        else "Photo accepted. Moving to the next inspection step.",
        "session": updated_session.model_dump(by_alias=True),
    }


def record_frame_intervention(
    *,
    session_id: str,
    step_id: str,
    status: str,
    guidance: str,
    confidence: float | None = None,
    visible_parts: list[str] | None = None,
    missing_parts: list[str] | None = None,
) -> dict[str, Any]:
    session = _load_session(session_id)
    step = _session_step(session, step_id)
    if step.kind != "photo":
        raise HTTPException(
            status_code=422,
            detail="Frame intervention can only be recorded for photo steps",
        )

    normalized_status = status.strip().lower()
    if normalized_status not in {"adjust", "hold"}:
        raise HTTPException(
            status_code=422,
            detail="Frame intervention status must be adjust or hold",
        )

    message = guidance.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Frame guidance is required")

    payload = {
        "source": "saarthi-realtime",
        "status": normalized_status,
        "visibleParts": visible_parts or [],
        "missingParts": missing_parts or [],
    }
    now = _utc_now()
    save_ai_intervention(
        intervention_id=f"ai_{uuid4().hex[:12]}",
        session_id=session_id,
        step_id=step.id,
        intervention_type=f"realtime_frame_{normalized_status}",
        message=message,
        confidence=0.0 if confidence is None else float(confidence),
        payload=payload,
        created_at=now,
    )

    capture_command = (
        {
            "command": "capture_now",
            "stepId": step.id,
        }
        if normalized_status == "hold"
        else None
    )
    return {
        "type": "frame_intervention",
        "status": normalized_status,
        "message": message,
        "readyToCapture": normalized_status == "hold",
        "captureCommand": capture_command,
    }


def _record_damage_observation(
    *,
    session_id: str,
    step: InspectionStep,
    transcript: str,
) -> dict[str, Any]:
    fields = structure_observation(transcript)
    now = _utc_now()
    save_structured_observation(
        observation_id=f"obs_{uuid4().hex[:12]}",
        session_id=session_id,
        step_id=step.id,
        field_id=step.field_id,
        transcript=transcript,
        issue=fields["issue"],
        severity=fields["severity"],
        confidence=0.92,
        payload=fields,
        created_at=now,
    )
    next_step_id = complete_step_and_activate_next(session_id, step.id, now)
    updated_session = _load_session(session_id)

    return {
        "type": "observation",
        "message": "Recorded door observation and moved to the next step.",
        "structuredFields": fields,
        "nextStep": _next_step(updated_session, next_step_id),
        "session": updated_session.model_dump(by_alias=True),
    }


def _record_engine_observation(
    *,
    session_id: str,
    step: InspectionStep,
    transcript: str,
    answers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if answers:
        fields = structure_engine_answer_options(answers)
        stored_transcript = transcript.strip() or engine_answers_to_transcript(answers)
    else:
        fields = structure_engine_answers(transcript)
        stored_transcript = transcript
    issue, severity = engine_issue_summary(fields)
    now = _utc_now()
    save_structured_observation(
        observation_id=f"obs_{uuid4().hex[:12]}",
        session_id=session_id,
        step_id=step.id,
        field_id=step.field_id,
        transcript=stored_transcript,
        issue=issue,
        severity=severity,
        confidence=0.88,
        payload=fields,
        created_at=now,
    )
    complete_step_and_activate_next(session_id, step.id, now)
    set_session_status(session_id, "ready_for_submission", now)
    updated_session = _load_session(session_id)

    return {
        "type": "engine",
        "message": "Engine observation recorded. Inspection is ready for submission.",
        "structuredFields": fields,
        "nextStep": None,
        "session": updated_session.model_dump(by_alias=True),
    }


def record_voice_observation(
    *,
    session_id: str,
    transcript: str,
    step_id: str | None = None,
    answers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    session = _load_session(session_id)
    step = _session_step(session, step_id)
    if step.kind == "engine-guided":
        return _record_engine_observation(
            answers=answers,
            session_id=session_id,
            step=step,
            transcript=transcript,
        )
    return _record_damage_observation(
        session_id=session_id,
        step=step,
        transcript=transcript,
    )


def complete_voice_inspection(session_id: str) -> dict[str, Any]:
    payload = load_session_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")

    completed_count = count_completed_steps(session_id)
    total_count = len(payload["plan"]["steps"])
    if completed_count < total_count:
        return {
            "type": "completion",
            "status": "pending",
            "message": "Inspection still has pending steps.",
            "completedStepCount": completed_count,
        }

    now = _utc_now()
    set_session_status(session_id, "completed", now)
    return {
        "type": "completion",
        "status": "completed",
        "message": "Thank you. Inspection submitted for pricing and audit.",
        "completedStepCount": completed_count,
    }


def build_voice_tools() -> ToolsSchema:
    parts_property = {
        "description": "Vehicle parts visible in the captured still photo.",
        "items": {"type": "string"},
        "type": "array",
    }
    transcript_property = {
        "description": "Exact answer spoken by the jockey.",
        "type": "string",
    }
    step_property = {
        "description": "Optional current inspection step id.",
        "type": "string",
    }
    yes_no_property = {
        "description": "AI-interpreted yes/no answer from the jockey.",
        "enum": ["yes", "no"],
        "type": "string",
    }
    return ToolsSchema(
        standard_tools=[
            FunctionSchema(
                name="accept_photo",
                description=(
                    "Accept the captured still photo for the current checklist "
                    "step. Call this only when the uploaded photo is usable. If "
                    "a retake is needed, do not call any tool; speak the fix."
                ),
                properties={
                    "stepId": {
                        "description": "Current photo inspection step id.",
                        "type": "string",
                    },
                    "guidance": {
                        "description": "Short spoken acceptance guidance.",
                        "type": "string",
                    },
                    "visibleParts": parts_property,
                },
                required=["stepId"],
            ),
            FunctionSchema(
                name="record_door_observation",
                description="Save a spoken LHS door damage answer to the inspection.",
                properties={
                    "transcript": transcript_property,
                    "stepId": step_property,
                },
                required=["transcript"],
            ),
            FunctionSchema(
                name="record_engine_observation",
                description=(
                    "Save AI-interpreted spoken engine Q&A answers to the "
                    "inspection after the jockey answers aloud."
                ),
                properties={
                    "stepId": step_property,
                    "transcript": transcript_property,
                    "knocking": yes_no_property,
                    "rattling": yes_no_property,
                    "idleVibration": {
                        "description": (
                            "AI-interpreted idle vibration level from the jockey."
                        ),
                        "enum": ["none", "mild", "heavy"],
                        "type": "string",
                    },
                    "exhaustSound": {
                        "description": (
                            "AI-interpreted exhaust sound category from the jockey."
                        ),
                        "enum": ["normal", "noisy", "smoke"],
                        "type": "string",
                    },
                },
                required=[
                    "knocking",
                    "rattling",
                    "idleVibration",
                    "exhaustSound",
                ],
            ),
            FunctionSchema(
                name="complete_inspection",
                description="Mark the inspection completed once every step is done.",
                properties={},
                required=[],
            ),
        ],
    )


def build_voice_function_handlers(
    session_id: str,
    get_pending_photo: Callable[[str], PendingPhotoReview | None] | None = None,
    on_capture_command: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
    on_frame_intervention: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
    on_tool_result: Callable[[str, dict[str, Any], bool], Awaitable[None]]
    | None = None,
    on_voice_result: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
):
    async def publish_tool_result(
        params: FunctionCallParams,
        result: dict[str, Any],
        *,
        create_response: bool = True,
    ) -> None:
        await params.result_callback(result)
        if on_tool_result:
            await on_tool_result(params.tool_call_id, result, create_response)

    async def record_frame(params: FunctionCallParams):
        arguments = params.arguments
        result = record_frame_intervention(
            session_id=session_id,
            step_id=str(arguments.get("stepId") or arguments.get("step_id") or ""),
            status=str(arguments.get("status") or ""),
            guidance=str(arguments.get("guidance") or ""),
            confidence=arguments.get("confidence"),
            visible_parts=_normalize_parts(
                arguments.get("visibleParts") or arguments.get("visible_parts"),
            ),
            missing_parts=_normalize_parts(
                arguments.get("missingParts") or arguments.get("missing_parts"),
            ),
        )
        await publish_tool_result(params, result, create_response=False)

        if on_frame_intervention:
            await on_frame_intervention(result)

        capture_command = result.get("captureCommand")
        if capture_command and on_capture_command:
            await on_capture_command(capture_command)

    async def accept_photo(params: FunctionCallParams):
        arguments = params.arguments
        step_id = str(arguments.get("stepId") or arguments.get("step_id") or "")
        pending_photo = get_pending_photo(step_id) if get_pending_photo else None
        if pending_photo is None:
            raise HTTPException(
                status_code=422,
                detail="No captured photo is pending review for this step",
            )

        result = accept_photo_evidence(
            session_id=session_id,
            step_id=step_id,
            pending_photo=pending_photo,
            guidance=str(arguments.get("guidance") or ""),
            visible_parts=_normalize_parts(
                arguments.get("visibleParts") or arguments.get("visible_parts"),
            ),
        )
        await publish_tool_result(params, result, create_response=False)
        if on_voice_result:
            await on_voice_result(result)

    async def record_observation(params: FunctionCallParams):
        transcript = str(params.arguments.get("transcript", "")).strip()
        step_id = params.arguments.get("stepId")
        result = record_voice_observation(
            session_id=session_id,
            step_id=str(step_id) if step_id else None,
            transcript=transcript,
        )
        await publish_tool_result(params, result)
        if on_voice_result:
            await on_voice_result(result)

    async def record_engine_observation(params: FunctionCallParams):
        arguments = params.arguments
        answers = {
            key: str(arguments.get(key) or "").strip()
            for key in ENGINE_ANSWER_KEYS
        }
        missing_answers = [key for key, value in answers.items() if not value]
        if missing_answers:
            raise HTTPException(
                status_code=422,
                detail=f"Missing engine answers: {', '.join(missing_answers)}",
            )

        transcript = str(arguments.get("transcript") or "").strip()
        step_id = arguments.get("stepId")
        result = record_voice_observation(
            answers=answers,
            session_id=session_id,
            step_id=str(step_id) if step_id else None,
            transcript=transcript,
        )
        await publish_tool_result(params, result)
        if on_voice_result:
            await on_voice_result(result)

    async def complete_inspection(params: FunctionCallParams):
        result = complete_voice_inspection(session_id)
        await publish_tool_result(params, result)
        if on_voice_result:
            await on_voice_result(result)

    return {
        "accept_photo": accept_photo,
        "record_frame_intervention": record_frame,
        "record_door_observation": record_observation,
        "record_engine_observation": record_engine_observation,
        "complete_inspection": complete_inspection,
    }
