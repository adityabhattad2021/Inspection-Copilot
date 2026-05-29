import os
from pathlib import Path
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from starlette.datastructures import FormData, UploadFile

from app.database import (
    complete_step_and_activate_next,
    get_session_step,
    load_session_payload,
    save_evidence_item,
)
from app.routes.sessions import InspectionStep, SessionResponse
from app.storage.s3_store import get_s3_bucket, upload_bytes

router = APIRouter(prefix="/evidence", tags=["evidence"])

BACKEND_ROOT = Path(__file__).resolve().parents[2]


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


def _evidence_root() -> Path:
    return Path(
        os.environ.get(
            "JOCKEY_COPILOT_EVIDENCE_DIR",
            str(BACKEND_ROOT / ".local" / "evidence"),
        )
    )


def _photo_object_key(session_id: str, step_id: str) -> str:
    return f"sessions/{session_id}/photos/{step_id}.jpg"


async def _parse_photo_request(
    http_request: Request,
) -> tuple[PhotoEvidenceRequest, UploadFile | None]:
    content_type = http_request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        form = await http_request.form()
        return _parse_multipart_photo_request(form), _get_uploaded_image(form)

    payload = await http_request.json()
    return PhotoEvidenceRequest.model_validate(payload), None


def _parse_multipart_photo_request(form: FormData) -> PhotoEvidenceRequest:
    return PhotoEvidenceRequest.model_validate(
        {
            "sessionId": form.get("sessionId"),
            "stepId": form.get("stepId"),
            "sampleKey": form.get("sampleKey"),
            "localUri": form.get("localUri"),
        }
    )


def _get_uploaded_image(form: FormData) -> UploadFile | None:
    image = form.get("image")
    return image if isinstance(image, UploadFile) else None


async def _store_uploaded_image(
    *,
    image: UploadFile,
    session_id: str,
    step_id: str,
) -> tuple[str, str, int, str]:
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=422, detail="Uploaded image is empty")

    content_type = image.content_type or "application/octet-stream"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Uploaded evidence must be an image")

    object_key = _photo_object_key(session_id, step_id)
    configured_bucket = os.environ.get("JOCKEY_COPILOT_S3_BUCKET")
    if configured_bucket:
        local_uri = upload_bytes(
            bucket=get_s3_bucket(),
            object_key=object_key,
            body=image_bytes,
            content_type=content_type,
        )
        return object_key, local_uri, len(image_bytes), content_type

    destination = _evidence_root() / object_key
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(image_bytes)
    return object_key, str(destination), len(image_bytes), content_type


def _validate_photo_request(
    request: PhotoEvidenceRequest,
    image: UploadFile | None,
) -> None:
    if request.local_uri and request.local_uri.startswith("realtime://") and image is None:
        raise HTTPException(
            status_code=422,
            detail="Realtime photo evidence requires an image upload",
        )


@router.post("/photo", response_model=PhotoEvidenceResponse)
async def save_photo_evidence(http_request: Request) -> PhotoEvidenceResponse:
    request, image = await _parse_photo_request(http_request)
    _validate_photo_request(request, image)

    step = get_session_step(request.session_id, request.step_id)
    if step is None:
        raise HTTPException(status_code=404, detail="Inspection step not found")

    now = _utc_now()
    evidence_id = f"ev_{uuid4().hex[:12]}"
    accepted = True
    image_metadata = {}
    object_key = _photo_object_key(request.session_id, request.step_id)
    local_uri = request.local_uri
    if image is not None:
        object_key, local_uri, image_bytes, image_mime_type = await _store_uploaded_image(
            image=image,
            session_id=request.session_id,
            step_id=request.step_id,
        )
        image_metadata = {
            "imageBytes": image_bytes,
            "imageMimeType": image_mime_type,
        }

    save_evidence_item(
        evidence_id=evidence_id,
        session_id=request.session_id,
        step_id=request.step_id,
        kind="photo",
        object_key=object_key,
        local_uri=local_uri,
        quality_score=0.93,
        accepted=accepted,
        metadata={"sampleKey": request.sample_key, **image_metadata},
        created_at=now,
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
