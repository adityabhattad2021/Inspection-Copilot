import os
import sys

from fastapi import FastAPI
from loguru import logger


def configure_logging() -> None:
    log_level = os.environ.get("JOCKEY_COPILOT_LOG_LEVEL", "INFO").upper()
    logger.remove()
    logger.add(sys.stderr, level=log_level)


configure_logging()

from app.routes.ai import router as ai_router
from app.routes.debug import router as debug_router
from app.routes.evidence import router as evidence_router
from app.routes.profiles import router as profiles_router
from app.routes.sessions import router as sessions_router
from app.routes.uploads import router as uploads_router
from app.routes.vehicles import router as vehicles_router
from app.routes.voice import router as voice_router
from app.voice.webrtc import close_voice_webrtc, router as voice_webrtc_router

app = FastAPI(title="Cars24 Jockey Copilot API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(vehicles_router)
app.include_router(profiles_router)
app.include_router(sessions_router)
app.include_router(ai_router)
app.include_router(evidence_router)
app.include_router(uploads_router)
app.include_router(debug_router)
app.include_router(voice_router)
app.include_router(voice_webrtc_router)
app.add_event_handler("shutdown", close_voice_webrtc)
