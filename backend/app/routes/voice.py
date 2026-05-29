from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.routes.sessions import InspectionStep, SessionResponse
from app.voice.config import get_voice_runtime_config
from app.voice.tools import record_voice_observation

router = APIRouter(prefix="/voice", tags=["voice"])


class VoiceConfigResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    provider: str
    llm_provider: str = Field(alias="llmProvider")
    transport: str
    start_url: str = Field(alias="startUrl")
    model: str
    voice: str
    ready: bool
    missing: list[str]


class VoiceTranscriptTurnRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(alias="sessionId")
    step_id: str | None = Field(default=None, alias="stepId")
    transcript: str = Field(min_length=1)


class VoiceTranscriptTurnResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: str
    message: str
    structured_fields: dict[str, Any] = Field(default_factory=dict, alias="structuredFields")
    next_step: InspectionStep | None = Field(default=None, alias="nextStep")
    session: SessionResponse | None = None


@router.get("/config", response_model=VoiceConfigResponse)
def get_voice_config() -> VoiceConfigResponse:
    config = get_voice_runtime_config()
    return VoiceConfigResponse(
        provider=config.provider,
        llm_provider=config.llm_provider,
        transport=config.transport,
        start_url=config.start_url,
        model=config.model,
        voice=config.voice,
        ready=config.ready,
        missing=config.missing,
    )


@router.post("/transcript-turn", response_model=VoiceTranscriptTurnResponse)
def record_transcript_turn(
    request: VoiceTranscriptTurnRequest,
) -> VoiceTranscriptTurnResponse:
    result = record_voice_observation(
        session_id=request.session_id,
        step_id=request.step_id,
        transcript=request.transcript,
    )
    return VoiceTranscriptTurnResponse.model_validate(result)
