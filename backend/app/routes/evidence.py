from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.database import (
    complete_step_and_activate_next,
    get_session_step,
    load_session_payload,
    save_evidence_item,
    set_step_status,
)
from app.routes.sessions import InspectionStep, SessionResponse

router = APIRouter(prefix="/evidence", tags=["evidence"])


class PhotoEvidenceRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId")
    step_id: str = Field(alias="stepId")
    sample_key: str = Field(alias="sampleKey")
    local_uri: str | None = Field(default=None, alias="localUri")


class PhotoEvidenceResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    evidence_id: str = Field(alias="evidenceId")
    accepted: bool
    completed_step_id: str = Field(alias="completedStepId")
    next_step: InspectionStep | None = Field(alias="nextStep")
    agent_message: str = Field(alias="agentMessage")
    session: SessionResponse


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _load_session(session_id: str) -> SessionResponse:
    payload = load_session_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")
    return SessionResponse.model_validate(payload)


def _next_step(session: SessionResponse, step_id: str | None) -> InspectionStep | None:
    if step_id is None:
        return None
    return next((step for step in session.plan.steps if step.id == step_id), None)


@router.post("/photo", response_model=PhotoEvidenceResponse)
def save_photo_evidence(request: PhotoEvidenceRequest) -> PhotoEvidenceResponse:
    step = get_session_step(request.session_id, request.step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Inspection step not found")

    now = _utc_now()
    evidence_id = f"ev_{uuid4().hex[:12]}"
    accepted = True
    save_evidence_item(
        evidence_id=evidence_id,
        session_id=request.session_id,
        step_id=request.step_id,
        kind="photo",
        object_key=f"sessions/{request.session_id}/photos/{request.step_id}.jpg",
        local_uri=request.local_uri,
        quality_score=0.93,
        accepted=accepted,
        metadata={"sampleKey": request.sample_key},
        created_at=now,
    )

    if request.step_id == "lhs-front-door":
        set_step_status(
            request.session_id,
            request.step_id,
            "needs_observation",
            now,
        )
        updated_session = _load_session(request.session_id)
        return PhotoEvidenceResponse(
            evidence_id=evidence_id,
            accepted=accepted,
            completed_step_id=request.step_id,
            next_step=None,
            agent_message=(
                "I see a possible mark near the door handle. Is it a scratch, "
                "dent, rust, or dirt?"
            ),
            session=updated_session,
        )

    next_step_id = complete_step_and_activate_next(
        request.session_id,
        request.step_id,
        now,
    )
    updated_session = _load_session(request.session_id)
    return PhotoEvidenceResponse(
        evidence_id=evidence_id,
        accepted=accepted,
        completed_step_id=request.step_id,
        next_step=_next_step(updated_session, next_step_id),
        agent_message="Photo accepted. Moving to the next inspection step.",
        session=updated_session,
    )
