from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

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


_sessions: dict[str, SessionResponse] = {}


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _generate_demo_plan() -> InspectionPlan:
    photo_auto_capture = AutoCaptureConfig(enabled=True, hold_ms=1200)
    return InspectionPlan(
        name="SUV Petrol Automatic Inspection Plan",
        steps=[
            InspectionStep(
                id="front-main",
                field_id=21,
                field_name="Front Main",
                section="Exterior & Tyres",
                kind="photo",
                instructions=(
                    "Show the full front bumper, bonnet line, headlight, "
                    "and front-left tyre."
                ),
                expected_parts=[
                    "front bumper",
                    "bonnet line",
                    "headlight",
                    "front-left tyre",
                ],
                auto_capture=photo_auto_capture,
            ),
            InspectionStep(
                id="rear-main",
                field_id=56,
                field_name="Rear Main",
                section="Exterior & Tyres",
                kind="photo",
                instructions="Show the full rear bumper, boot line, and tail lamps.",
                expected_parts=["rear bumper", "boot line", "tail lamps"],
                auto_capture=photo_auto_capture,
            ),
            InspectionStep(
                id="lhs-front-door",
                field_id=45,
                field_name="LHS front door",
                section="Exterior & Tyres",
                kind="photo",
                instructions="Show the left front door and handle area clearly.",
                expected_parts=["left front door", "door handle"],
                auto_capture=photo_auto_capture,
            ),
            InspectionStep(
                id="dashboard-odometer",
                field_id=93,
                field_name="Dashboard and odometer reading",
                section="Interior & Electricals",
                kind="photo",
                instructions="Show the dashboard, instrument cluster, and odometer.",
                expected_parts=["dashboard", "instrument cluster", "odometer"],
                auto_capture=photo_auto_capture,
            ),
            InspectionStep(
                id="engine-sound",
                field_id=104,
                field_name="Engine sound condition",
                section="Engine",
                kind="engine-guided",
                instructions=(
                    "Start the engine, listen at idle, rev gently, and record "
                    "knocking, rattling, vibration, or exhaust issues."
                ),
                expected_parts=[],
            ),
        ],
    )


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(request: CreateSessionRequest) -> SessionResponse:
    vehicle = lookup_demo_vehicle(request.registration_number)
    now = _utc_now()
    session = SessionResponse(
        session_id=f"insp_{uuid4().hex[:12]}",
        status="created",
        vehicle=vehicle,
        plan=_generate_demo_plan(),
        created_at=now,
        updated_at=now,
    )
    _sessions[session.session_id] = session
    return session


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str) -> SessionResponse:
    session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")
    return session
