from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.database import (
    list_profile_payloads,
    load_profile_payload,
    save_profile_payload,
)

router = APIRouter(prefix="/profiles", tags=["profiles"])

InstructionLanguageCode = Literal["en-IN", "hi-IN", "kn-IN", "hinglish"]

LANGUAGE_LABELS: dict[InstructionLanguageCode, str] = {
    "en-IN": "English",
    "hi-IN": "Hindi",
    "kn-IN": "Kannada",
    "hinglish": "Hinglish",
}


class CreateProfileRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=80)
    language_code: InstructionLanguageCode = Field(alias="languageCode")

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Name cannot be blank")
        return value


class ProfileResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    profile_id: str = Field(alias="profileId")
    name: str
    language_code: InstructionLanguageCode = Field(alias="languageCode")
    language_label: str = Field(alias="languageLabel")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")


class ProfileListResponse(BaseModel):
    profiles: list[ProfileResponse]


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


@router.post("", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
def create_profile(request: CreateProfileRequest) -> ProfileResponse:
    now = _utc_now()
    profile = ProfileResponse(
        profile_id=f"jockey_{uuid4().hex[:12]}",
        name=request.name.strip(),
        language_code=request.language_code,
        language_label=LANGUAGE_LABELS[request.language_code],
        created_at=now,
        updated_at=now,
    )
    save_profile_payload(profile.model_dump(by_alias=True))
    return profile


@router.get("", response_model=ProfileListResponse)
def list_profiles() -> ProfileListResponse:
    return ProfileListResponse(
        profiles=[
            ProfileResponse.model_validate(profile)
            for profile in list_profile_payloads()
        ]
    )


@router.get("/{profile_id}", response_model=ProfileResponse)
def get_profile(profile_id: str) -> ProfileResponse:
    payload = load_profile_payload(profile_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Jockey profile not found")
    return ProfileResponse.model_validate(payload)
