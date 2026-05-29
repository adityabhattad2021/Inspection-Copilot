import base64
import json
import os
from typing import Any

from loguru import logger
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.processors.frameworks.rtvi import RTVIObserverParams
from pipecat.services.openai.realtime import events
from pipecat.transports.base_transport import TransportParams

from app.database import load_session_payload
from app.voice.config import (
    VOICE_LLM_PROVIDER_GEMINI,
    VOICE_LLM_PROVIDER_OPENAI,
    get_google_api_key,
    get_voice_runtime_config,
)
from app.voice.prompts import build_realtime_instruction
from app.voice.tools import (
    PendingPhotoReview,
    build_voice_function_handlers,
    build_voice_tools,
)


LANGUAGE_TRANSCRIPTION_CODES = {
    "en-IN": "en",
    "hi-IN": "hi",
    "hinglish": "hi",
    "kn-IN": "kn",
}
GEMINI_LANGUAGE_CODES = {
    "en-IN": "en-IN",
    "hi-IN": "hi-IN",
    "hinglish": "hi-IN",
    "kn-IN": "kn-IN",
}
INSPECTION_CONTROL_ACK_TYPE = "inspection_control_ack"
INSPECTION_CONTROL_ERROR_TYPE = "inspection_control_error"
INSPECTION_CONTROL_PREVIEW_LENGTH = 180
INSPECTION_CONTROL_PHOTO_CHUNK_TYPE = "inspection-control-photo-chunk"
MAX_PHOTO_TRANSFER_CHUNKS = 128
RealtimePhotoTransfers = dict[str, list[str | None]]


def _runner_body(runner_args: Any) -> dict[str, Any]:
    body = getattr(runner_args, "body", None) or {}
    if not isinstance(body, dict):
        return {}
    nested_body = body.get("body")
    if isinstance(nested_body, dict):
        return nested_body
    return body


def resolve_runner_session_id(runner_args: Any) -> str:
    body = _runner_body(runner_args)
    session_id = body.get("sessionId") or body.get("session_id")
    if session_id:
        return str(session_id)
    runner_session_id = getattr(runner_args, "session_id", None)
    if runner_session_id:
        return str(runner_session_id)
    raise RuntimeError("Missing inspection session id for realtime voice bot")


def build_realtime_session_properties(
    *,
    instruction: str,
    language_code: str | None,
    tools: ToolsSchema,
    voice: str,
) -> events.SessionProperties:
    transcription_language = LANGUAGE_TRANSCRIPTION_CODES.get(language_code or "en-IN")
    return events.SessionProperties(
        output_modalities=["audio"],
        instructions=instruction,
        audio=events.AudioConfiguration(
            input=events.AudioInput(
                transcription=events.InputAudioTranscription(
                    model="gpt-realtime-whisper",
                    language=transcription_language,
                ),
                turn_detection=events.SemanticTurnDetection(
                    eagerness="auto",
                    create_response=True,
                    interrupt_response=True,
                ),
            ),
            output=events.AudioOutput(voice=voice),
        ),
        tools=tools,
        tool_choice="auto",
    )


def resolve_gemini_language_code(language_code: str | None) -> str:
    return GEMINI_LANGUAGE_CODES.get(language_code or "en-IN", "en-IN")


def build_initial_realtime_messages(_instruction: str) -> list[dict[str, str]]:
    return [
        {
            "role": "user",
            "content": (
                "Give only a short opening greeting in the requested language. "
                "Introduce yourself as Saarthi with an energetic inspection "
                "navigator feel, tell the jockey you will call angles and "
                "evidence, and ask them to get ready. Localize naturally; do "
                "not force English radio phrases if they sound strange. Do not "
                "mention any inspection step, checklist field, camera angle, "
                "or vehicle part yet."
            ),
        },
    ]


def build_realtime_text_events(
    content: str,
) -> tuple[events.ConversationItemCreateEvent, events.ResponseCreateEvent]:
    item_event = events.ConversationItemCreateEvent(
        item=events.ConversationItem(
            role="user",
            type="message",
            content=[events.ItemContent(type="input_text", text=content)],
        ),
    )
    return item_event, events.ResponseCreateEvent()


def build_realtime_photo_review_events(
    content: str,
    image_data_url: str,
    detail: str = "high",
) -> tuple[events.ConversationItemCreateEvent, events.ResponseCreateEvent]:
    item_event = events.ConversationItemCreateEvent(
        item=events.ConversationItem(
            role="user",
            type="message",
            content=[
                events.ItemContent(type="input_text", text=content),
                events.ItemContent(
                    type="input_image",
                    image_url=image_data_url,
                    detail=detail,
                ),
            ],
        ),
    )
    return item_event, events.ResponseCreateEvent()


def build_realtime_tool_result_events(
    tool_call_id: str,
    result: dict[str, Any],
    *,
    create_response: bool = True,
) -> tuple[events.ConversationItemCreateEvent, events.ResponseCreateEvent | None]:
    item_event = events.ConversationItemCreateEvent(
        item=events.ConversationItem(
            type="function_call_output",
            call_id=tool_call_id,
            output=json.dumps(result, ensure_ascii=False),
        ),
    )
    response_event = events.ResponseCreateEvent() if create_response else None
    return item_event, response_event


def build_inspection_control_ack(content: str) -> dict[str, Any]:
    return {
        "contentPreview": content[:INSPECTION_CONTROL_PREVIEW_LENGTH],
        "received": True,
        "type": INSPECTION_CONTROL_ACK_TYPE,
    }


def build_inspection_control_error(error: str) -> dict[str, Any]:
    return {
        "error": error,
        "type": INSPECTION_CONTROL_ERROR_TYPE,
    }


def build_voice_rtvi_observer_params() -> RTVIObserverParams:
    return RTVIObserverParams(user_llm_enabled=False)


def build_voice_transport_params(
    *,
    llm_provider: str = VOICE_LLM_PROVIDER_OPENAI,
) -> TransportParams:
    audio_in_sample_rate = 16000
    if llm_provider == VOICE_LLM_PROVIDER_OPENAI:
        audio_in_sample_rate = 24000

    return TransportParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        audio_in_sample_rate=audio_in_sample_rate,
        audio_out_sample_rate=24000,
        video_in_enabled=False,
    )


def decode_image_data_url(image_data_url: str) -> tuple[bytes, str]:
    header, separator, encoded = image_data_url.partition(",")
    if separator != "," or not header.startswith("data:"):
        raise ValueError("Captured photo must be a data URL")
    if not header.endswith(";base64"):
        raise ValueError("Captured photo data URL must be base64 encoded")

    mime_type = header.removeprefix("data:").removesuffix(";base64")
    if not mime_type.startswith("image/"):
        raise ValueError("Captured photo must be an image")

    image_bytes = base64.b64decode(encoded, validate=True)
    if not image_bytes:
        raise ValueError("Captured photo is empty")
    return image_bytes, mime_type


def store_realtime_photo_transfer_chunk(
    transfers: RealtimePhotoTransfers,
    *,
    transfer_id: str,
    chunk_index: int,
    chunk_count: int,
    chunk: str,
) -> None:
    if not transfer_id.strip():
        raise ValueError("Captured photo transfer requires transferId")
    if chunk_count <= 0 or chunk_count > MAX_PHOTO_TRANSFER_CHUNKS:
        raise ValueError("Captured photo transfer chunk count is invalid")
    if chunk_index < 0 or chunk_index >= chunk_count:
        raise ValueError("Captured photo transfer chunk index is invalid")
    if not isinstance(chunk, str) or not chunk:
        raise ValueError("Captured photo transfer chunk is empty")

    existing_chunks = transfers.setdefault(transfer_id, [None] * chunk_count)
    if len(existing_chunks) != chunk_count:
        raise ValueError("Captured photo transfer chunk count changed")
    existing_chunks[chunk_index] = chunk


def resolve_realtime_photo_transfer(
    transfers: RealtimePhotoTransfers,
    transfer_id: str,
) -> str:
    chunks = transfers.get(transfer_id)
    if chunks is None:
        raise ValueError("Captured photo transfer was not found")
    if any(chunk is None for chunk in chunks):
        raise ValueError("Captured photo transfer is incomplete")

    transfers.pop(transfer_id, None)
    return "".join(chunk for chunk in chunks if chunk is not None)


async def bot(runner_args: Any):
    from pipecat.frames.frames import (
        InputTextRawFrame,
        LLMContextFrame,
        LLMMessagesAppendFrame,
    )
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.pipeline.task import PipelineParams, PipelineTask
    from pipecat.processors.frameworks.rtvi import RTVIProcessor
    from pipecat.processors.aggregators.llm_context import LLMContext
    from pipecat.services.openai.realtime.llm import OpenAIRealtimeLLMService
    from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

    body = _runner_body(runner_args)
    session_id = resolve_runner_session_id(runner_args)
    language_code = body.get("languageCode") or body.get("language_code")
    jockey_name = body.get("jockeyName") or body.get("jockey_name")
    session_payload = load_session_payload(session_id)
    if session_payload is None:
        raise RuntimeError(f"Inspection session not found: {session_id}")

    runtime = get_voice_runtime_config()
    if runtime.llm_provider == VOICE_LLM_PROVIDER_GEMINI:
        api_key = get_google_api_key()
        if not api_key:
            raise RuntimeError("GOOGLE_API_KEY is required for Gemini realtime voice")
    elif runtime.llm_provider == VOICE_LLM_PROVIDER_OPENAI:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for OpenAI realtime voice")
    else:
        raise RuntimeError(f"Unsupported voice LLM provider: {runtime.llm_provider}")

    tools = build_voice_tools()
    instruction = build_realtime_instruction(
        session=session_payload,
        jockey_name=str(jockey_name) if jockey_name else None,
        language_code=str(language_code) if language_code else None,
    )

    transport = SmallWebRTCTransport(
        runner_args.webrtc_connection,
        params=build_voice_transport_params(llm_provider=runtime.llm_provider),
    )

    if runtime.llm_provider == VOICE_LLM_PROVIDER_GEMINI:
        from pipecat.services.google.gemini_live.llm import (
            GeminiLiveLLMService,
            GeminiModalities,
        )

        llm = GeminiLiveLLMService(
            api_key=api_key,
            tools=tools,
            settings=GeminiLiveLLMService.Settings(
                model=runtime.model,
                voice=runtime.voice,
                modalities=GeminiModalities.AUDIO,
                language=resolve_gemini_language_code(
                    str(language_code) if language_code else None
                ),
                system_instruction=instruction,
            ),
        )
        context = LLMContext(messages=build_initial_realtime_messages(instruction))
    else:
        session_properties = build_realtime_session_properties(
            instruction=instruction,
            language_code=str(language_code) if language_code else None,
            tools=tools,
            voice=runtime.voice,
        )
        llm = OpenAIRealtimeLLMService(
            api_key=api_key,
            model=runtime.model,
            session_properties=session_properties,
            video_frame_detail="low",
        )
        context = LLMContext(
            messages=build_initial_realtime_messages(instruction),
            tools=tools,
            tool_choice="auto",
        )

    rtvi = RTVIProcessor(transport=transport)

    async def send_capture_command(command: dict[str, Any]) -> None:
        await rtvi.send_server_message(command)

    async def send_frame_intervention(intervention: dict[str, Any]) -> None:
        await rtvi.send_server_message(intervention)

    async def send_voice_result(result: dict[str, Any]) -> None:
        await rtvi.send_server_message(result)

    async def inject_realtime_user_text(content: str) -> None:
        if runtime.llm_provider == VOICE_LLM_PROVIDER_GEMINI:
            await task.queue_frame(InputTextRawFrame(text=content))
            return

        item_event, response_event = build_realtime_text_events(content)
        await llm.send_client_event(item_event)
        await llm.send_client_event(response_event)

    async def inject_realtime_photo_review(
        content: str,
        image_data_url: str,
    ) -> None:
        if runtime.llm_provider == VOICE_LLM_PROVIDER_GEMINI:
            await task.queue_frame(
                LLMMessagesAppendFrame(
                    messages=[
                        LLMContext.create_image_url_message(
                            role="user",
                            url=image_data_url,
                            text=content,
                        )
                    ],
                    run_llm=True,
                )
            )
            return

        item_event, response_event = build_realtime_photo_review_events(
            content,
            image_data_url,
        )
        await llm.send_client_event(item_event)
        await llm.send_client_event(response_event)

    async def send_realtime_tool_result(
        tool_call_id: str,
        result: dict[str, Any],
        create_response: bool,
    ) -> None:
        item_event, response_event = build_realtime_tool_result_events(
            tool_call_id,
            result,
            create_response=create_response,
        )
        await llm.send_client_event(item_event)
        if response_event:
            await llm.send_client_event(response_event)

    pending_photo_reviews: dict[str, PendingPhotoReview] = {}
    photo_transfers: RealtimePhotoTransfers = {}

    def get_pending_photo(step_id: str) -> PendingPhotoReview | None:
        return pending_photo_reviews.get(step_id)

    for name, handler in build_voice_function_handlers(
        session_id,
        get_pending_photo=get_pending_photo,
        on_capture_command=send_capture_command,
        on_frame_intervention=send_frame_intervention,
        on_tool_result=(
            send_realtime_tool_result
            if runtime.llm_provider == VOICE_LLM_PROVIDER_OPENAI
            else None
        ),
        on_voice_result=send_voice_result,
    ).items():
        llm.register_function(name, handler)

    pipeline = Pipeline([transport.input(), llm, transport.output()])
    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=(
                16000
                if runtime.llm_provider == VOICE_LLM_PROVIDER_GEMINI
                else 24000
            ),
            audio_out_sample_rate=24000,
            enable_metrics=False,
            enable_usage_metrics=False,
        ),
        rtvi_processor=rtvi,
        rtvi_observer_params=build_voice_rtvi_observer_params(),
    )

    has_queued_initial_context = False

    @rtvi.event_handler("on_client_ready")
    async def on_client_ready(_):
        nonlocal has_queued_initial_context
        if has_queued_initial_context:
            return
        has_queued_initial_context = True
        await task.queue_frame(LLMContextFrame(context=context))

    @rtvi.event_handler("on_client_message")
    async def on_client_message(_, message):
        if message.type == INSPECTION_CONTROL_PHOTO_CHUNK_TYPE:
            data = message.data if isinstance(message.data, dict) else {}
            try:
                store_realtime_photo_transfer_chunk(
                    photo_transfers,
                    transfer_id=str(data.get("transferId") or ""),
                    chunk_index=int(data.get("chunkIndex")),
                    chunk_count=int(data.get("chunkCount")),
                    chunk=str(data.get("chunk") or ""),
                )
            except Exception as exc:
                logger.exception(
                    "Failed to store photo chunk session_id={}",
                    session_id,
                )
                await rtvi.send_server_message(build_inspection_control_error(str(exc)))
                raise
            return

        if message.type != "inspection-control":
            logger.debug(
                "Ignoring RTVI client message type={} session_id={}",
                message.type,
                session_id,
            )
            return

        data = message.data if isinstance(message.data, dict) else {}
        content = data.get("content")
        if not isinstance(content, str) or not content.strip():
            logger.warning(
                "Received empty inspection-control message session_id={} data={}",
                session_id,
                data,
            )
            return

        cleaned_content = content.strip()
        image_data_url = data.get("imageDataUrl") or data.get("image_data_url")
        image_transfer_id = data.get("imageTransferId") or data.get("image_transfer_id")
        step_id = data.get("stepId") or data.get("step_id")
        source_uri = data.get("sourceUri") or data.get("source_uri")
        is_photo_review = bool(
            isinstance(image_data_url, str)
            and image_data_url.strip()
            or isinstance(image_transfer_id, str)
            and image_transfer_id.strip()
        )
        logger.info(
            "Received inspection-control session_id={} has_photo={} preview={!r}",
            session_id,
            is_photo_review,
            cleaned_content[:INSPECTION_CONTROL_PREVIEW_LENGTH],
        )
        try:
            if is_photo_review:
                if not isinstance(step_id, str) or not step_id.strip():
                    raise ValueError("Captured photo review requires stepId")
                if isinstance(image_transfer_id, str) and image_transfer_id.strip():
                    image_data_url = resolve_realtime_photo_transfer(
                        photo_transfers,
                        image_transfer_id.strip(),
                    )
                if not isinstance(image_data_url, str):
                    raise ValueError("Captured photo review requires an image")
                image_bytes, mime_type = decode_image_data_url(image_data_url.strip())
                review_step_id = step_id.strip()
                pending_photo_reviews[review_step_id] = PendingPhotoReview(
                    image_bytes=image_bytes,
                    mime_type=mime_type,
                    source_uri=str(source_uri) if source_uri else None,
                )
                await rtvi.send_server_message(
                    build_inspection_control_ack(cleaned_content)
                )
                await inject_realtime_photo_review(
                    cleaned_content,
                    image_data_url.strip(),
                )
            else:
                await rtvi.send_server_message(
                    build_inspection_control_ack(cleaned_content)
                )
                await inject_realtime_user_text(cleaned_content)
            logger.info(
                "Injected inspection-control into {} realtime session_id={}",
                runtime.llm_provider,
                session_id,
            )
        except Exception as exc:
            logger.exception(
                "Failed to inject inspection-control session_id={}",
                session_id,
            )
            await rtvi.send_server_message(build_inspection_control_error(str(exc)))
            raise

    runner = PipelineRunner()
    await runner.run(task)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
