from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.database import (
    complete_step_and_activate_next,
    load_session_payload,
    save_ai_intervention,
    save_structured_observation,
    set_session_status,
)
from app.routes.sessions import InspectionStep, SessionResponse
from app.services.ai_stub import analyze_live_frame, structure_observation
from app.services.engine_check import engine_issue_summary, structure_engine_answers

router = APIRouter(prefix="/ai", tags=["ai"])


class LiveFrameAnalysisRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId")
    step_id: str = Field(alias="stepId")
    sample_key: str = Field(alias="sampleKey")


class LiveFrameAnalysisResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    status: str
    guidance: str
    ready_to_capture: bool = Field(alias="readyToCapture")
    confidence: float
    visible_parts: list[str] = Field(alias="visibleParts")
    problems: list[str]


class StructureObservationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId")
    step_id: str = Field(alias="stepId")
    transcript: str = Field(min_length=1)


class StructureObservationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    observation_id: str = Field(alias="observationId")
    summary: str
    structured_fields: dict[str, Any] = Field(alias="structuredFields")
    next_step: InspectionStep | None = Field(alias="nextStep")
    session: SessionResponse


class EngineCheckRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId")
    step_id: str = Field(alias="stepId")
    phase: str
    transcript: str | None = None


class EngineCheckResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    phase: str
    next_phase: str | None = Field(default=None, alias="nextPhase")
    agent_message: str = Field(alias="agentMessage")
    questions: list[str]
    is_complete: bool = Field(alias="isComplete")
    structured_fields: dict[str, Any] = Field(alias="structuredFields")
    session: SessionResponse | None = None


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _load_session(session_id: str) -> SessionResponse:
    payload = load_session_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")
    return SessionResponse.model_validate(payload)


def _session_step(session: SessionResponse, step_id: str) -> InspectionStep:
    step = next((step for step in session.plan.steps if step.id == step_id), None)
    if step is None:
        raise HTTPException(status_code=404, detail="Inspection step not found")
    return step


def _next_step(session: SessionResponse, step_id: str | None) -> InspectionStep | None:
    if step_id is None:
        return None
    return next((step for step in session.plan.steps if step.id == step_id), None)


@router.post("/analyze-live-frame", response_model=LiveFrameAnalysisResponse)
def analyze_live_frame_endpoint(
    request: LiveFrameAnalysisRequest,
) -> LiveFrameAnalysisResponse:
    session = _load_session(request.session_id)
    step = _session_step(session, request.step_id)
    try:
        result = analyze_live_frame(request.sample_key, step.expected_parts)
    except KeyError as exc:
        raise HTTPException(
            status_code=422,
            detail="Unrecognized live frame input",
        ) from exc
    now = _utc_now()
    intervention_type = (
        "live_frame_hold" if result["readyToCapture"] else "live_frame_adjust"
    )
    save_ai_intervention(
        intervention_id=f"ai_{uuid4().hex[:12]}",
        session_id=request.session_id,
        step_id=request.step_id,
        intervention_type=intervention_type,
        message=result["guidance"],
        confidence=result["confidence"],
        payload={"sampleKey": request.sample_key, **result},
        created_at=now,
    )

    return LiveFrameAnalysisResponse.model_validate(result)


@router.post("/structure-observation", response_model=StructureObservationResponse)
def structure_observation_endpoint(
    request: StructureObservationRequest,
) -> StructureObservationResponse:
    session = _load_session(request.session_id)
    step = _session_step(session, request.step_id)
    fields = structure_observation(request.transcript)
    now = _utc_now()
    observation_id = f"obs_{uuid4().hex[:12]}"

    save_structured_observation(
        observation_id=observation_id,
        session_id=request.session_id,
        step_id=request.step_id,
        field_id=step.field_id,
        transcript=request.transcript,
        issue=fields["issue"],
        severity=fields["severity"],
        confidence=0.92,
        payload=fields,
        created_at=now,
    )
    next_step_id = complete_step_and_activate_next(
        request.session_id,
        request.step_id,
        now,
    )
    updated_session = _load_session(request.session_id)

    return StructureObservationResponse(
        observation_id=observation_id,
        summary="Noted minor scratch and no dent on the left front door.",
        structured_fields=fields,
        next_step=_next_step(updated_session, next_step_id),
        session=updated_session,
    )


@router.post("/engine-check", response_model=EngineCheckResponse)
def engine_check_endpoint(request: EngineCheckRequest) -> EngineCheckResponse:
    session = _load_session(request.session_id)
    step = _session_step(session, request.step_id)
    if step.kind != "engine-guided":
        raise HTTPException(status_code=400, detail="Step is not an engine check")

    if request.phase != "final":
        return EngineCheckResponse(
            phase=request.phase,
            next_phase="final",
            agent_message=(
                "Start the engine, listen at idle, rev gently once, then tell me "
                "about knocking, rattling, vibration, and exhaust sound."
            ),
            questions=[
                "Any knocking or rattling?",
                "Any abnormal vibration at idle?",
                "Does the exhaust sound normal?",
            ],
            is_complete=False,
            structured_fields={},
            session=session,
        )

    transcript = request.transcript or ""
    fields = structure_engine_answers(transcript)
    issue, severity = engine_issue_summary(fields)
    now = _utc_now()
    save_structured_observation(
        observation_id=f"obs_{uuid4().hex[:12]}",
        session_id=request.session_id,
        step_id=request.step_id,
        field_id=step.field_id,
        transcript=transcript,
        issue=issue,
        severity=severity,
        confidence=0.88,
        payload=fields,
        created_at=now,
    )
    complete_step_and_activate_next(request.session_id, request.step_id, now)
    set_session_status(request.session_id, "ready_for_submission", now)
    updated_session = _load_session(request.session_id)

    return EngineCheckResponse(
        phase="final",
        next_phase=None,
        agent_message="Engine sound check captured. No knocking or rattling reported.",
        questions=[],
        is_complete=True,
        structured_fields=fields,
        session=updated_session,
    )
