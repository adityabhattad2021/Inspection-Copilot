import uuid
from http import HTTPMethod
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Request, Response
from loguru import logger
from pipecat.runner.types import SmallWebRTCRunnerArguments
from pipecat.transports.smallwebrtc.connection import IceServer, SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    IceCandidate,
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

from app.voice.realtime_bot import bot

router = APIRouter(tags=["voice-webrtc"])

_active_sessions: dict[str, dict[str, Any]] = {}
_small_webrtc_handler = SmallWebRTCRequestHandler()


@router.post("/api/offer")
async def offer(
    request: SmallWebRTCRequest,
    background_tasks: BackgroundTasks,
    session_id: str | None = None,
):
    resolved_session_id = session_id or str(uuid.uuid4())

    async def webrtc_connection_callback(connection: SmallWebRTCConnection):
        runner_args = SmallWebRTCRunnerArguments(
            webrtc_connection=connection,
            body=request.request_data,
            session_id=resolved_session_id,
        )
        background_tasks.add_task(bot, runner_args)

    return await _small_webrtc_handler.handle_web_request(
        request=request,
        webrtc_connection_callback=webrtc_connection_callback,
    )


@router.patch("/api/offer")
async def ice_candidate(request: SmallWebRTCPatchRequest):
    await _small_webrtc_handler.handle_patch_request(request)
    return {"status": "success"}


@router.post("/start")
async def start_voice_session(request: Request):
    try:
        request_data = await request.json()
    except Exception as exc:
        logger.error(f"Failed to parse Pipecat start body: {exc}")
        request_data = {}

    session_id = str(uuid.uuid4())
    _active_sessions[session_id] = request_data.get("body", {})
    result: dict[str, Any] = {"sessionId": session_id}

    if request_data.get("enableDefaultIceServers"):
        result["iceConfig"] = {
            "iceServers": [IceServer(urls=["stun:stun.l.google.com:19302"]).model_dump()]
        }

    return result


@router.api_route(
    "/sessions/{session_id}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
async def proxy_voice_request(
    session_id: str,
    path: str,
    request: Request,
    background_tasks: BackgroundTasks,
):
    active_session = _active_sessions.get(session_id)
    if active_session is None:
        return Response(content="Invalid or not-yet-ready session_id", status_code=404)

    if path.endswith("api/offer"):
        try:
            request_data = await request.json()
            if request.method == HTTPMethod.POST.value:
                webrtc_request = SmallWebRTCRequest(
                    sdp=request_data["sdp"],
                    type=request_data["type"],
                    pc_id=request_data.get("pc_id"),
                    restart_pc=request_data.get("restart_pc"),
                    request_data=(
                        request_data.get("request_data")
                        or request_data.get("requestData")
                        or active_session
                    ),
                )
                return await offer(
                    webrtc_request,
                    background_tasks,
                    session_id=session_id,
                )
            if request.method == HTTPMethod.PATCH.value:
                patch_request = SmallWebRTCPatchRequest(
                    pc_id=request_data["pc_id"],
                    candidates=[
                        IceCandidate(**candidate)
                        for candidate in request_data.get("candidates", [])
                    ],
                )
                return await ice_candidate(patch_request)
        except Exception as exc:
            logger.error(f"Failed to parse WebRTC request: {exc}")
            return Response(content="Invalid WebRTC request", status_code=400)

    return Response(status_code=200)


async def close_voice_webrtc() -> None:
    await _small_webrtc_handler.close()
