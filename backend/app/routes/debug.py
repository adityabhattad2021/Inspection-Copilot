import json
import os
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, status
from pydantic import BaseModel, ConfigDict, Field


DEFAULT_FLOW_LOG_PATH = (
    Path(__file__).resolve().parents[2] / ".local" / "inspection-flow.ndjson"
)

router = APIRouter(prefix="/debug", tags=["debug"])


class InspectionFlowLogRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    event: str = Field(min_length=1)
    session_id: str | None = Field(default=None, alias="sessionId")
    screen: str | None = None
    step_id: str | None = Field(default=None, alias="stepId")
    payload: dict[str, Any] = Field(default_factory=dict)


class InspectionFlowLogResponse(BaseModel):
    status: str


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _get_flow_log_path() -> Path:
    configured_path = os.environ.get("INSPECTION_COPILOT_FLOW_LOG_PATH")
    if configured_path:
        return Path(configured_path)
    return DEFAULT_FLOW_LOG_PATH


def _session_log_filename(session_id: str) -> str:
    safe_session_id = re.sub(r"[^A-Za-z0-9_.-]+", "_", session_id).strip("._-")
    if not safe_session_id:
        safe_session_id = "unknown-session"
    return f"{safe_session_id}.ndjson"


def _get_session_flow_log_path(session_id: str | None) -> Path:
    base_log_path = _get_flow_log_path()
    if not session_id:
        return base_log_path

    return base_log_path.parent / base_log_path.stem / _session_log_filename(session_id)


@router.post(
    "/inspection-flow-log",
    response_model=InspectionFlowLogResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def append_inspection_flow_log(
    request: InspectionFlowLogRequest,
) -> InspectionFlowLogResponse:
    log_path = _get_session_flow_log_path(request.session_id)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "loggedAt": _utc_now(),
        "event": request.event,
        "sessionId": request.session_id,
        "screen": request.screen,
        "stepId": request.step_id,
        "payload": request.payload,
    }

    with log_path.open("a", encoding="utf-8") as file:
        file.write(json.dumps(entry, ensure_ascii=False, sort_keys=True))
        file.write("\n")

    return InspectionFlowLogResponse(status="logged")
