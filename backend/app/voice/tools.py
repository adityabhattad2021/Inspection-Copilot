from datetime import UTC, datetime
from collections.abc import Awaitable, Callable
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
    save_structured_observation,
    set_session_status,
)
from app.routes.sessions import InspectionStep, SessionResponse
from app.services.ai_stub import structure_observation
from app.services.engine_check import engine_issue_summary, structure_engine_answers


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


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
) -> dict[str, Any]:
    fields = structure_engine_answers(transcript)
    issue, severity = engine_issue_summary(fields)
    now = _utc_now()
    save_structured_observation(
        observation_id=f"obs_{uuid4().hex[:12]}",
        session_id=session_id,
        step_id=step.id,
        field_id=step.field_id,
        transcript=transcript,
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
) -> dict[str, Any]:
    session = _load_session(session_id)
    step = _session_step(session, step_id)
    if step.kind == "engine-guided":
        return _record_engine_observation(
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
        "description": "Visible or missing vehicle parts named by the live frame judge.",
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
    return ToolsSchema(
        standard_tools=[
            FunctionSchema(
                name="record_frame_intervention",
                description=(
                    "Record Saarthi's live camera-frame judgment. Use status "
                    "adjust when required parts are missing or cropped. Use "
                    "status hold only when the photo step is framed well enough "
                    "for the mobile app to capture."
                ),
                properties={
                    "stepId": {
                        "description": "Current photo inspection step id.",
                        "type": "string",
                    },
                    "status": {
                        "description": "Frame decision: adjust or hold.",
                        "enum": ["adjust", "hold"],
                        "type": "string",
                    },
                    "guidance": {
                        "description": "Short spoken guidance for the jockey.",
                        "type": "string",
                    },
                    "confidence": {
                        "description": "Model confidence between 0 and 1.",
                        "type": "number",
                    },
                    "visibleParts": parts_property,
                    "missingParts": parts_property,
                },
                required=["stepId", "status", "guidance"],
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
                description="Save a spoken guided engine-sound answer to the inspection.",
                properties={
                    "transcript": transcript_property,
                    "stepId": step_property,
                },
                required=["transcript"],
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
    on_capture_command: Callable[[dict[str, Any]], Awaitable[None]] | None = None,
):
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
        await params.result_callback(result)

        capture_command = result.get("captureCommand")
        if capture_command and on_capture_command:
            await on_capture_command(capture_command)

    async def record_observation(params: FunctionCallParams):
        transcript = str(params.arguments.get("transcript", "")).strip()
        step_id = params.arguments.get("stepId")
        result = record_voice_observation(
            session_id=session_id,
            step_id=str(step_id) if step_id else None,
            transcript=transcript,
        )
        await params.result_callback(result)

    async def complete_inspection(params: FunctionCallParams):
        await params.result_callback(complete_voice_inspection(session_id))

    return {
        "record_frame_intervention": record_frame,
        "record_door_observation": record_observation,
        "record_engine_observation": record_observation,
        "complete_inspection": complete_inspection,
    }
