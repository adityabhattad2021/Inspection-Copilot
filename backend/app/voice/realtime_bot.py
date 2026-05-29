import os
from typing import Any

from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.processors.frameworks.rtvi import RTVIObserverParams
from pipecat.services.openai.realtime import events

from app.database import load_session_payload
from app.voice.config import get_voice_runtime_config
from app.voice.prompts import build_realtime_instruction
from app.voice.tools import build_voice_function_handlers, build_voice_tools


LANGUAGE_TRANSCRIPTION_CODES = {
    "en-IN": "en",
    "hi-IN": "hi",
    "hinglish": "hi",
    "kn-IN": "kn",
}


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


def build_initial_realtime_messages(instruction: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": instruction},
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


def build_voice_rtvi_observer_params() -> RTVIObserverParams:
    return RTVIObserverParams(user_llm_enabled=False)


async def bot(runner_args: Any):
    from pipecat.frames.frames import LLMContextFrame
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.pipeline.task import PipelineParams, PipelineTask
    from pipecat.processors.frameworks.rtvi import RTVIProcessor
    from pipecat.processors.aggregators.llm_context import LLMContext
    from pipecat.services.openai.realtime.llm import OpenAIRealtimeLLMService
    from pipecat.transports.base_transport import TransportParams
    from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required for realtime voice")

    body = _runner_body(runner_args)
    session_id = resolve_runner_session_id(runner_args)
    language_code = body.get("languageCode") or body.get("language_code")
    jockey_name = body.get("jockeyName") or body.get("jockey_name")
    session_payload = load_session_payload(session_id)
    if session_payload is None:
        raise RuntimeError(f"Inspection session not found: {session_id}")

    runtime = get_voice_runtime_config()
    tools = build_voice_tools()
    instruction = build_realtime_instruction(
        session=session_payload,
        jockey_name=str(jockey_name) if jockey_name else None,
        language_code=str(language_code) if language_code else None,
    )
    session_properties = build_realtime_session_properties(
        instruction=instruction,
        language_code=str(language_code) if language_code else None,
        tools=tools,
        voice=runtime.voice,
    )

    transport = SmallWebRTCTransport(
        runner_args.webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_in_sample_rate=24000,
            audio_out_sample_rate=24000,
        ),
    )
    llm = OpenAIRealtimeLLMService(
        api_key=api_key,
        model=runtime.model,
        session_properties=session_properties,
    )
    for name, handler in build_voice_function_handlers(session_id).items():
        llm.register_function(name, handler)

    context = LLMContext(
        messages=build_initial_realtime_messages(instruction),
        tools=tools,
        tool_choice="auto",
    )
    rtvi = RTVIProcessor(transport=transport)
    pipeline = Pipeline([transport.input(), llm, transport.output()])
    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=24000,
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

    runner = PipelineRunner()
    await runner.run(task)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
