import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


VOICE_LLM_PROVIDER_GEMINI = "gemini"
VOICE_LLM_PROVIDER_OPENAI = "openai"
VOICE_LLM_PROVIDERS = {VOICE_LLM_PROVIDER_GEMINI, VOICE_LLM_PROVIDER_OPENAI}

DEFAULT_VOICE_LLM_PROVIDER = VOICE_LLM_PROVIDER_GEMINI
DEFAULT_GEMINI_LIVE_MODEL = "models/gemini-3.1-flash-live-preview"
DEFAULT_GEMINI_LIVE_VOICE = "Charon"
DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime-2"
DEFAULT_OPENAI_REALTIME_VOICE = "alloy"
DEFAULT_VOICE_BASE_URL = "http://localhost:8000"
DEFAULT_VOICE_ICE_SERVERS: list[dict[str, Any]] = [
    {"urls": ["stun:stun.l.google.com:19302"]},
]
DEFAULT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"

# Backwards-compatible names for existing imports and local scripts.
DEFAULT_REALTIME_MODEL = DEFAULT_OPENAI_REALTIME_MODEL
DEFAULT_REALTIME_VOICE = DEFAULT_OPENAI_REALTIME_VOICE


@dataclass(frozen=True)
class VoiceRuntimeConfig:
    provider: str
    llm_provider: str
    transport: str
    start_url: str
    model: str
    voice: str
    ready: bool
    missing: list[str]


def load_voice_environment() -> None:
    env_file = os.environ.get("JOCKEY_COPILOT_ENV_FILE")
    load_dotenv(dotenv_path=env_file or DEFAULT_ENV_FILE, override=False)


def get_google_api_key() -> str | None:
    load_voice_environment()
    return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")


def get_voice_llm_provider() -> str:
    load_voice_environment()
    provider = os.environ.get("VOICE_LLM_PROVIDER", DEFAULT_VOICE_LLM_PROVIDER)
    normalized_provider = provider.strip().lower()
    if normalized_provider not in VOICE_LLM_PROVIDERS:
        supported = ", ".join(sorted(VOICE_LLM_PROVIDERS))
        raise ValueError(f"VOICE_LLM_PROVIDER must be one of: {supported}")
    return normalized_provider


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
    llm_provider = get_voice_llm_provider()

    missing: list[str] = []
    if llm_provider == VOICE_LLM_PROVIDER_GEMINI:
        if not get_google_api_key():
            missing.append("GOOGLE_API_KEY")
        model = os.environ.get("GOOGLE_MODEL", DEFAULT_GEMINI_LIVE_MODEL)
        voice = os.environ.get("GOOGLE_VOICE_ID", DEFAULT_GEMINI_LIVE_VOICE)
    else:
        if not os.environ.get("OPENAI_API_KEY"):
            missing.append("OPENAI_API_KEY")
        model = os.environ.get("OPENAI_REALTIME_MODEL", DEFAULT_OPENAI_REALTIME_MODEL)
        voice = os.environ.get("OPENAI_REALTIME_VOICE", DEFAULT_OPENAI_REALTIME_VOICE)

    return VoiceRuntimeConfig(
        provider="pipecat",
        llm_provider=llm_provider,
        transport="small-webrtc",
        start_url=start_url,
        model=model,
        voice=voice,
        ready=len(missing) == 0,
        missing=missing,
    )
