from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict, Field

from app.database import (
    activate_first_step,
    build_inspection_plan,
    count_completed_steps,
    list_ai_interventions,
    list_evidence_items,
    list_structured_observations,
    load_report_payload,
    load_session_payload,
    save_report_payload,
    save_session_payload,
    set_session_status,
)
from app.routes.vehicles import VehicleProfile, lookup_demo_vehicle
from app.services.report_generator import (
    build_report_payload,
    render_report_html,
    report_metadata,
)

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


class StartSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    jockey_name: str | None = Field(default=None, alias="jockeyName")
    language_code: str | None = Field(default=None, alias="languageCode")


class SessionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId")
    status: str
    vehicle: VehicleProfile
    plan: InspectionPlan
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class StartSessionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session: SessionResponse
    active_step: InspectionStep | None = Field(alias="activeStep")
    agent_message: str = Field(alias="agentMessage")


class ReportMetadataResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    report_id: str = Field(alias="reportId")
    session_id: str = Field(alias="sessionId")
    status: str
    completion_score: float = Field(alias="completionScore")
    media_quality_score: float = Field(alias="mediaQualityScore")
    pricing_risk: str = Field(alias="pricingRisk")
    report_json_url: str = Field(alias="reportJsonUrl")
    report_html_url: str = Field(alias="reportHtmlUrl")
    download_url: str = Field(alias="downloadUrl")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class CompleteSessionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId")
    status: str
    completed_step_count: int = Field(alias="completedStepCount")
    agent_message: str = Field(alias="agentMessage")
    report: ReportMetadataResponse


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _active_step(session: SessionResponse) -> InspectionStep | None:
    return next(
        (
            step
            for step in session.plan.steps
            if step.status in {"active", "needs_observation"}
        ),
        None,
    )


def _assert_reportable_session(session_id: str, payload: dict[str, Any]) -> int:
    completed_count = count_completed_steps(session_id)
    total_count = len(payload["plan"]["steps"])
    if completed_count < total_count:
        raise HTTPException(status_code=409, detail="Inspection has pending steps")
    return completed_count


def _create_report_payload(session_id: str) -> dict[str, Any]:
    payload = load_session_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")

    _assert_reportable_session(session_id, payload)
    now = _utc_now()
    report_payload = build_report_payload(
        report_id=f"rpt_{uuid4().hex[:12]}",
        session=payload,
        evidence=list_evidence_items(session_id),
        observations=list_structured_observations(session_id),
        ai_interventions=list_ai_interventions(session_id),
        generated_at=now,
    )
    save_report_payload(report_payload)
    return report_payload


def _load_report_or_404(session_id: str) -> dict[str, Any]:
    payload = load_report_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection report not found")
    return payload


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


@router.post("/{session_id}/start", response_model=StartSessionResponse)
def start_session(
    session_id: str,
    request: StartSessionRequest,
) -> StartSessionResponse:
    payload = load_session_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")

    activate_first_step(session_id, _utc_now())
    updated_payload = load_session_payload(session_id)
    if updated_payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")

    session = SessionResponse.model_validate(updated_payload)
    active_step = _active_step(session)
    vehicle = session.vehicle
    name_prefix = f"{request.jockey_name}, " if request.jockey_name else ""
    message = (
        f"{name_prefix}Saarthi is ready for the {vehicle.year} "
        f"{vehicle.make} {vehicle.model} inspection."
    )

    return StartSessionResponse(
        session=session,
        active_step=active_step,
        agent_message=message,
    )


@router.post("/{session_id}/complete", response_model=CompleteSessionResponse)
def complete_session(session_id: str) -> CompleteSessionResponse:
    payload = load_session_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")

    completed_count = _assert_reportable_session(session_id, payload)

    now = _utc_now()
    set_session_status(session_id, "completed", now)
    report_payload = _create_report_payload(session_id)
    return CompleteSessionResponse(
        session_id=session_id,
        status="completed",
        completed_step_count=completed_count,
        agent_message="Thank you. Inspection submitted for pricing and audit.",
        report=ReportMetadataResponse.model_validate(report_metadata(report_payload)),
    )


@router.post("/{session_id}/report", response_model=ReportMetadataResponse)
def create_report(session_id: str) -> ReportMetadataResponse:
    report_payload = _create_report_payload(session_id)
    return ReportMetadataResponse.model_validate(report_metadata(report_payload))


@router.get("/{session_id}/report")
def get_report(session_id: str) -> dict[str, Any]:
    return _load_report_or_404(session_id)["reportJson"]


@router.get("/{session_id}/report.html", response_class=HTMLResponse)
def get_report_html(session_id: str) -> HTMLResponse:
    payload = _load_report_or_404(session_id)
    return HTMLResponse(
        content=render_report_html(payload["reportJson"]),
        headers={
            "Content-Disposition": (
                f'attachment; filename="inspection-report-{session_id}.html"'
            )
        },
    )


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(session_id: str) -> SessionResponse:
    payload = load_session_payload(session_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Inspection session not found")
    return SessionResponse.model_validate(payload)
