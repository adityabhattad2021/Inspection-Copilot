import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


DEFAULT_REALTIME_MODEL = "gpt-realtime-2"
DEFAULT_REALTIME_VOICE = "alloy"
DEFAULT_VOICE_BASE_URL = "http://localhost:8000"
DEFAULT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


@dataclass(frozen=True)
class VoiceRuntimeConfig:
    provider: str
    transport: str
    start_url: str
    model: str
    voice: str
    ready: bool
    missing: list[str]


def load_voice_environment() -> None:
    env_file = os.environ.get("JOCKEY_COPILOT_ENV_FILE")
    load_dotenv(dotenv_path=env_file or DEFAULT_ENV_FILE, override=False)


def get_voice_runtime_config() -> VoiceRuntimeConfig:
    load_voice_environment()

    base_url = os.environ.get("JOCKEY_COPILOT_VOICE_BASE_URL", DEFAULT_VOICE_BASE_URL)
    start_url = f"{base_url.rstrip('/')}/start"
    missing = []
    if not os.environ.get("OPENAI_API_KEY"):
        missing.append("OPENAI_API_KEY")

    return VoiceRuntimeConfig(
        provider="pipecat",
        transport="small-webrtc",
        start_url=start_url,
        model=os.environ.get("OPENAI_REALTIME_MODEL", DEFAULT_REALTIME_MODEL),
        voice=os.environ.get("OPENAI_REALTIME_VOICE", DEFAULT_REALTIME_VOICE),
        ready=len(missing) == 0,
        missing=missing,
    )
