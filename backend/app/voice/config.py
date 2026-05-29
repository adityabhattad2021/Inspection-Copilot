import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


DEFAULT_REALTIME_MODEL = "gpt-realtime-2"
DEFAULT_REALTIME_VOICE = "alloy"
DEFAULT_VOICE_BASE_URL = "http://localhost:8000"
DEFAULT_VOICE_ICE_SERVERS: list[dict[str, Any]] = [
    {"urls": ["stun:stun.l.google.com:19302"]},
]
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


def _normalize_ice_server(candidate: Any) -> dict[str, Any]:
    if isinstance(candidate, str):
        return {"urls": [candidate]}
    if not isinstance(candidate, dict):
        raise ValueError("ICE server entries must be strings or objects")

    urls = candidate.get("urls")
    if isinstance(urls, str):
        normalized_urls = [urls]
    elif isinstance(urls, list) and all(isinstance(url, str) for url in urls):
        normalized_urls = urls
    else:
        raise ValueError("ICE server entries require urls as a string or string list")

    server = {"urls": normalized_urls}
    if isinstance(candidate.get("username"), str):
        server["username"] = candidate["username"]
    if isinstance(candidate.get("credential"), str):
        server["credential"] = candidate["credential"]
    return server


def get_voice_ice_servers() -> list[dict[str, Any]]:
    load_voice_environment()

    configured = os.environ.get("JOCKEY_COPILOT_ICE_SERVERS_JSON")
    if not configured:
        return DEFAULT_VOICE_ICE_SERVERS

    parsed = json.loads(configured)
    if not isinstance(parsed, list):
        raise ValueError("JOCKEY_COPILOT_ICE_SERVERS_JSON must be a JSON list")
    return [_normalize_ice_server(entry) for entry in parsed]


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
