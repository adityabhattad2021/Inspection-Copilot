from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.storage.s3_store import (
    DEFAULT_PRESIGN_EXPIRES_IN,
    audio_object_key,
    create_presigned_upload_url,
    get_s3_bucket,
    photo_object_key,
)

router = APIRouter(prefix="/uploads", tags=["uploads"])


class PresignUploadRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId")
    step_id: str | None = Field(default=None, alias="stepId")
    kind: str
    content_type: str = Field(alias="contentType")


class PresignUploadResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    upload_url: str = Field(alias="uploadUrl")
    object_key: str = Field(alias="objectKey")
    expires_in: int = Field(alias="expiresIn")


def _object_key_for_request(request: PresignUploadRequest) -> str:
    if request.kind == "photo":
        if not request.step_id:
            raise HTTPException(status_code=422, detail="Photo uploads require stepId")
        return photo_object_key(request.session_id, request.step_id)

    if request.kind == "audio":
        return audio_object_key(request.session_id)

    raise HTTPException(status_code=422, detail="Unsupported upload kind")


@router.post("/presign", response_model=PresignUploadResponse)
def presign_upload(request: PresignUploadRequest) -> PresignUploadResponse:
    bucket = get_s3_bucket()
    object_key = _object_key_for_request(request)
    upload_url = create_presigned_upload_url(
        bucket=bucket,
        object_key=object_key,
        content_type=request.content_type,
        expires_in=DEFAULT_PRESIGN_EXPIRES_IN,
    )
    return PresignUploadResponse(
        upload_url=upload_url,
        object_key=object_key,
        expires_in=DEFAULT_PRESIGN_EXPIRES_IN,
    )
