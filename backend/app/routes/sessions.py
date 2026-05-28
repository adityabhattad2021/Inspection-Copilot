from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from app.database import (
    build_inspection_plan,
    load_session_payload,
    save_session_payload,
)
from app.routes.vehicles import VehicleProfile, lookup_demo_vehicle

router = APIRouter(prefix="/sessions", tags=["sessions"])


class AutoCaptureConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    enabled: bool
    hold_ms: int = Field(alias="holdMs")


class InspectionStep(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    field_id: int = Field(alias="fieldId")
    field_name: str = Field(alias="fieldName")
    section: str
    kind: str
    instructions: str
    expected_parts: list[str] = Field(alias="expectedParts")
    status: str = "pending"
    auto_capture: AutoCaptureConfig | None = Field(default=None, alias="autoCapture")


class InspectionPlan(BaseModel):
    name: str
    steps: list[InspectionStep]


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    registration_number: str = Field(alias="registrationNumber", min_length=1)


class SessionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId")
    status: str
    vehicle: VehicleProfile
    plan: InspectionPlan
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(request: CreateSessionRequest) -> SessionResponse:
    vehicle = lookup_demo_vehicle(request.registration_number)
    plan_template_id, plan_payload = build_inspection_plan(vehicle.model_dump())
    now = _utc_now()
    session = SessionResponse(
        session_id=f"insp_{uuid4().hex[:12]}",
        status="created",
        vehicle=vehicle,
        plan=InspectionPlan.model_validate(plan_payload),
        created_at=now,
        updated_at=now,
    )
    save_session_payload(session.model_dump(by_alias=True), plan_template_id)
    return session


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str) -> SessionResponse:
    payload = load_session_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")
    return SessionResponse.model_validate(payload)
