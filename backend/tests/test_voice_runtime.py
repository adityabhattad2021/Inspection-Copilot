import asyncio
import json
import os
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.database import clear_database, seed_database
from app.main import app
from app.voice.config import get_voice_ice_servers, get_voice_runtime_config
from app.voice.prompts import build_realtime_instruction
from app.voice.realtime_bot import (
    build_inspection_control_ack,
    build_inspection_control_error,
    build_initial_realtime_messages,
    build_realtime_photo_review_events,
    build_realtime_session_properties,
    build_realtime_text_events,
    build_realtime_tool_result_events,
    build_voice_transport_params,
    build_voice_rtvi_observer_params,
    decode_image_data_url,
    is_realtime_photo_review_message,
    resolve_runner_session_id,
    resolve_realtime_photo_transfer,
    store_realtime_photo_transfer_chunk,
)
from app.voice.tools import (
    PendingPhotoReview,
    accept_photo_evidence,
    build_voice_function_handlers,
    build_voice_tools,
    record_frame_intervention,
    record_voice_observation,
)


client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_sqlite_db(monkeypatch, tmp_path):
    monkeypatch.setenv("INSPECTION_COPILOT_DB_PATH", str(tmp_path / "voice.db"))
    monkeypatch.setenv("INSPECTION_COPILOT_ENV_FILE", str(tmp_path / "missing.env"))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_REALTIME_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_REALTIME_VOICE", raising=False)
    monkeypatch.delenv("VOICE_LLM_PROVIDER", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_MODEL", raising=False)
    monkeypatch.delenv("GOOGLE_VOICE_ID", raising=False)
    monkeypatch.delenv("INSPECTION_COPILOT_VOICE_BASE_URL", raising=False)
    monkeypatch.delenv("INSPECTION_COPILOT_ICE_SERVERS_JSON", raising=False)
    clear_database()
    seed_database()


def _create_started_session() -> str:
    create_response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )
    assert create_response.status_code == 201
    session_id = create_response.json()["sessionId"]

    start_response = client.post(
        f"/sessions/{session_id}/start",
        json={"inspectorName": "Aditya", "languageCode": "hi-IN"},
    )
    assert start_response.status_code == 200

    return session_id


def _capture_step(session_id: str, step_id: str, sample_key: str):
    response = client.post(
        "/evidence/photo",
        json={
            "sessionId": session_id,
            "stepId": step_id,
            "sampleKey": sample_key,
            "localUri": f"sample://{sample_key}",
        },
    )
    assert response.status_code == 200
    return response.json()


def test_voice_config_defaults_to_gemini_live_without_requiring_mobile_secret(
    monkeypatch,
):
    response = client.get("/voice/config")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "provider": "pipecat",
        "llmProvider": "gemini",
        "transport": "small-webrtc",
        "startUrl": "http://localhost:8000/start",
        "model": "models/gemini-3.1-flash-live-preview",
        "voice": "Charon",
        "ready": False,
        "missing": ["GOOGLE_API_KEY"],
    }


def test_voice_config_loads_gemini_key_from_backend_env_file(monkeypatch, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "GOOGLE_API_KEY=google-test-local",
                "GOOGLE_MODEL=models/gemini-test-live",
                "GOOGLE_VOICE_ID=Puck",
                "INSPECTION_COPILOT_VOICE_BASE_URL=http://127.0.0.1:8787",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("INSPECTION_COPILOT_ENV_FILE", str(env_file))

    config = get_voice_runtime_config()

    assert config.ready is True
    assert config.missing == []
    assert config.llm_provider == "gemini"
    assert config.model == "models/gemini-test-live"
    assert config.voice == "Puck"
    assert config.start_url == "http://127.0.0.1:8787/start"


def test_voice_config_can_roll_back_to_openai_with_one_provider_env(monkeypatch):
    monkeypatch.setenv("VOICE_LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-local")
    monkeypatch.setenv("OPENAI_REALTIME_MODEL", "gpt-realtime-local")
    monkeypatch.setenv("OPENAI_REALTIME_VOICE", "ash")

    config = get_voice_runtime_config()

    assert config.ready is True
    assert config.missing == []
    assert config.llm_provider == "openai"
    assert config.model == "gpt-realtime-local"
    assert config.voice == "ash"


def test_voice_config_accepts_gemini_api_key_alias(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-test-local")

    config = get_voice_runtime_config()

    assert config.ready is True
    assert config.missing == []
    assert config.llm_provider == "gemini"


def test_voice_ice_servers_default_to_public_stun():
    assert get_voice_ice_servers() == [
        {"urls": ["stun:stun.l.google.com:19302"]},
    ]


def test_voice_ice_servers_can_be_configured_for_turn(monkeypatch):
    monkeypatch.setenv(
        "INSPECTION_COPILOT_ICE_SERVERS_JSON",
        json.dumps(
            [
                "stun:stun.example.com:19302",
                {
                    "credential": "turn-pass",
                    "urls": ["turn:turn.example.com:3478"],
                    "username": "turn-user",
                },
            ]
        ),
    )

    assert get_voice_ice_servers() == [
        {"urls": ["stun:stun.example.com:19302"]},
        {
            "credential": "turn-pass",
            "urls": ["turn:turn.example.com:3478"],
            "username": "turn-user",
        },
    ]


def test_voice_start_endpoint_runs_on_the_main_fastapi_app():
    response = client.post(
        "/start",
        json={"body": {"sessionId": "insp_local", "languageCode": "hi-IN"}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["sessionId"]
    assert body["iceConfig"] == {
        "iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}],
    }


def test_voice_start_endpoint_returns_configured_turn_ice(monkeypatch):
    monkeypatch.setenv(
        "INSPECTION_COPILOT_ICE_SERVERS_JSON",
        json.dumps(
            [
                {
                    "credential": "turn-pass",
                    "urls": ["turn:turn.example.com:3478"],
                    "username": "turn-user",
                }
            ]
        ),
    )

    response = client.post(
        "/start",
        json={"body": {"sessionId": "insp_local", "languageCode": "hi-IN"}},
    )

    assert response.status_code == 200
    assert response.json()["iceConfig"] == {
        "iceServers": [
            {
                "credential": "turn-pass",
                "urls": ["turn:turn.example.com:3478"],
                "username": "turn-user",
            }
        ],
    }


def test_realtime_instruction_includes_vehicle_step_language_and_guardrails():
    session_id = _create_started_session()
    session = client.get(f"/sessions/{session_id}").json()

    instruction = build_realtime_instruction(
        session=session,
        inspector_name="Aditya",
        language_code="hi-IN",
    )

    assert "Inspection Copilot" in instruction
    assert "Saarthi" in instruction
    assert "rally navigator" in instruction
    assert "Never speak setup or debug phrasing" in instruction
    assert "physical next action" in instruction
    assert "Localize naturally" in instruction
    assert "on comms" in instruction
    assert "Aditya" in instruction
    assert "Hindi" in instruction
    assert "2020 Hyundai Creta" in instruction
    assert "Front Main" in instruction
    assert "captured still photo" in instruction
    assert "CAPTURED_PHOTO_REVIEW" in instruction
    assert "For Front Main, confirm" not in instruction
    assert "accept_photo" in instruction
    assert "do not call any tool" in instruction
    assert "Speech alone never advances photo state" in instruction
    assert "Never narrate internal review, checking, thinking, or recording" in instruction
    assert "For a photo retake, the first spoken words must be the physical fix" in instruction
    assert "For engine-sound checks, never speak filler like recording or one second" in instruction
    assert "Do not diagnose mechanical condition from audio" in instruction
    assert "SYSTEM_GUIDANCE:" not in instruction
    assert "SYSTEM_EVENT:" in instruction


def test_realtime_bot_starts_with_immediate_greeting_turn():
    messages = build_initial_realtime_messages(
        "You are Inspection Copilot. Speak Hindi."
    )

    assert len(messages) == 1
    assert messages[0]["role"] == "user"
    assert "short opening greeting" in messages[0]["content"]
    assert "Saarthi" in messages[0]["content"]
    assert "inspection navigator" in messages[0]["content"]
    assert "Localize naturally" in messages[0]["content"]
    assert "English radio phrases" in messages[0]["content"]
    assert "Do not mention any inspection step" in messages[0]["content"]
    assert "first inspection step" not in messages[0]["content"]


def test_realtime_text_events_inject_user_message_and_create_response():
    item_event, response_event = build_realtime_text_events(
        "SYSTEM_EVENT: Start Front Main."
    )

    assert item_event.type == "conversation.item.create"
    assert item_event.item.type == "message"
    assert item_event.item.role == "user"
    assert item_event.item.content is not None
    assert item_event.item.content[0].type == "input_text"
    assert item_event.item.content[0].text == "SYSTEM_EVENT: Start Front Main."
    assert response_event.type == "response.create"


def test_realtime_photo_review_events_inject_text_and_captured_image():
    item_event, response_event = build_realtime_photo_review_events(
        content="CAPTURED_PHOTO_REVIEW for Front Main.",
        image_data_url="data:image/jpeg;base64,/9j/demo",
    )

    assert item_event.type == "conversation.item.create"
    assert item_event.item.type == "message"
    assert item_event.item.role == "user"
    assert item_event.item.content is not None
    assert item_event.item.content[0].type == "input_text"
    assert item_event.item.content[0].text == "CAPTURED_PHOTO_REVIEW for Front Main."
    assert item_event.item.content[1].type == "input_image"
    assert item_event.item.content[1].image_url == "data:image/jpeg;base64,/9j/demo"
    assert item_event.item.content[1].detail == "high"
    assert response_event.type == "response.create"


def test_realtime_photo_data_url_decodes_to_pending_review_bytes():
    image_bytes, mime_type = decode_image_data_url(
        "data:image/jpeg;base64,/9hwZW5kaW5nLXJldmlld//Z"
    )

    assert image_bytes == b"\xff\xd8pending-review\xff\xd9"
    assert mime_type == "image/jpeg"


def test_realtime_photo_transfer_chunks_reassemble_in_order_and_clear_buffer():
    transfers = {}

    store_realtime_photo_transfer_chunk(
        transfers,
        transfer_id="photo_123",
        chunk_index=1,
        chunk_count=3,
        chunk="BBB",
    )
    store_realtime_photo_transfer_chunk(
        transfers,
        transfer_id="photo_123",
        chunk_index=0,
        chunk_count=3,
        chunk="AAA",
    )
    store_realtime_photo_transfer_chunk(
        transfers,
        transfer_id="photo_123",
        chunk_index=2,
        chunk_count=3,
        chunk="CCC",
    )

    assert resolve_realtime_photo_transfer(transfers, "photo_123") == "AAABBBCCC"
    assert "photo_123" not in transfers


def test_realtime_photo_transfer_waits_for_all_chunks_before_reassembly():
    transfers = {}

    store_realtime_photo_transfer_chunk(
        transfers,
        transfer_id="photo_123",
        chunk_index=0,
        chunk_count=2,
        chunk="AAA",
    )

    with pytest.raises(ValueError, match="incomplete"):
        resolve_realtime_photo_transfer(transfers, "photo_123")

    assert "photo_123" in transfers


def test_realtime_step_instruction_that_mentions_photo_review_is_not_photo_payload():
    assert (
        is_realtime_photo_review_message(
            content=(
                "SYSTEM_EVENT: STEP_CHANGED 1: Front Main. "
                "Wait for CAPTURED_PHOTO_REVIEW before deciding whether to accept."
            ),
            image_data_url=None,
            image_transfer_id=None,
        )
        is False
    )


def test_realtime_photo_review_requires_explicit_image_payload_marker():
    assert (
        is_realtime_photo_review_message(
            content="SYSTEM_EVENT: CAPTURED_PHOTO_REVIEW for Front Main.",
            image_data_url=None,
            image_transfer_id="photo_123",
        )
        is True
    )


def test_realtime_tool_result_events_return_output_and_create_response():
    item_event, response_event = build_realtime_tool_result_events(
        "call_frame_adjust",
        {
            "type": "frame_intervention",
            "status": "adjust",
            "message": "camera car ke front par lao",
        },
    )

    assert item_event.type == "conversation.item.create"
    assert item_event.item.type == "function_call_output"
    assert item_event.item.call_id == "call_frame_adjust"
    assert json.loads(item_event.item.output) == {
        "type": "frame_intervention",
        "status": "adjust",
        "message": "camera car ke front par lao",
    }
    assert response_event.type == "response.create"


def test_realtime_tool_result_events_can_skip_follow_up_response():
    item_event, response_event = build_realtime_tool_result_events(
        "call_frame_hold",
        {"type": "frame_intervention", "message": "Hold steady."},
        create_response=False,
    )

    assert item_event.type == "conversation.item.create"
    assert item_event.item.type == "function_call_output"
    assert response_event is None


def test_inspection_control_ack_is_safe_for_mobile_logs():
    content = "SYSTEM_EVENT: " + ("Judge this frame. " * 30)

    ack = build_inspection_control_ack(content)

    assert ack["type"] == "inspection_control_ack"
    assert ack["received"] is True
    assert ack["contentPreview"] == content[:180]


def test_inspection_control_error_keeps_error_message_for_debugging():
    error = build_inspection_control_error("Realtime rejected response.create")

    assert error == {
        "type": "inspection_control_error",
        "error": "Realtime rejected response.create",
    }


def test_voice_tools_expose_frame_observation_and_completion_functions():
    tools = build_voice_tools()

    assert [tool.name for tool in tools.standard_tools] == [
        "accept_photo",
        "record_engine_observation",
        "complete_inspection",
    ]
    engine_tool = next(
        tool for tool in tools.standard_tools if tool.name == "record_engine_observation"
    )
    assert engine_tool.required == [
        "knocking",
        "rattling",
        "idleVibration",
        "exhaustSound",
    ]
    assert engine_tool.properties["knocking"]["enum"] == ["yes", "no"]
    assert engine_tool.properties["rattling"]["enum"] == ["yes", "no"]
    assert engine_tool.properties["idleVibration"]["enum"] == [
        "none",
        "mild",
        "heavy",
    ]
    assert engine_tool.properties["exhaustSound"]["enum"] == [
        "normal",
        "noisy",
        "smoke",
    ]


def test_voice_transport_params_disable_pipecat_camera_frames_for_vision_camera():
    params = build_voice_transport_params()

    assert params.audio_in_enabled is True
    assert params.audio_out_enabled is True
    assert params.video_in_enabled is False
    assert params.audio_in_sample_rate == 24000
    assert params.audio_out_sample_rate == 24000


def test_gemini_voice_transport_uses_google_live_audio_sample_rates():
    params = build_voice_transport_params(llm_provider="gemini")

    assert params.audio_in_enabled is True
    assert params.audio_out_enabled is True
    assert params.video_in_enabled is False
    assert params.audio_in_sample_rate == 16000
    assert params.audio_out_sample_rate == 24000


def test_record_frame_intervention_saves_adjust_decision():
    session_id = _create_started_session()

    result = record_frame_intervention(
        session_id=session_id,
        step_id="front-main",
        status="adjust",
        guidance="Step back. Front-left tyre is missing.",
        confidence=0.81,
        visible_parts=["front bumper", "headlight"],
        missing_parts=["front-left tyre"],
    )

    assert result == {
        "type": "frame_intervention",
        "status": "adjust",
        "message": "Step back. Front-left tyre is missing.",
        "readyToCapture": False,
        "captureCommand": None,
    }

    with sqlite3.connect(os.environ["INSPECTION_COPILOT_DB_PATH"]) as connection:
        connection.row_factory = sqlite3.Row
        row = connection.execute(
            """
            SELECT step_id, type, message, confidence, payload_json
            FROM ai_interventions
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    assert row["step_id"] == "front-main"
    assert row["type"] == "realtime_frame_adjust"
    assert row["message"] == "Step back. Front-left tyre is missing."
    assert row["confidence"] == 0.81
    assert json.loads(row["payload_json"]) == {
        "source": "saarthi-realtime",
        "status": "adjust",
        "visibleParts": ["front bumper", "headlight"],
        "missingParts": ["front-left tyre"],
    }


def test_record_frame_intervention_returns_capture_command_on_hold():
    session_id = _create_started_session()

    result = record_frame_intervention(
        session_id=session_id,
        step_id="front-main",
        status="hold",
        guidance="Good frame. Hold steady.",
        confidence=0.94,
        visible_parts=[
            "front bumper",
            "bonnet line",
            "headlight",
            "front-left tyre",
        ],
        missing_parts=[],
    )

    assert result == {
        "type": "frame_intervention",
        "status": "hold",
        "message": "Good frame. Hold steady.",
        "readyToCapture": True,
        "captureCommand": {
            "command": "capture_now",
            "stepId": "front-main",
        },
    }


def test_accept_photo_evidence_stores_pending_photo_and_advances_step(tmp_path, monkeypatch):
    monkeypatch.setenv("INSPECTION_COPILOT_EVIDENCE_DIR", str(tmp_path / "evidence"))
    session_id = _create_started_session()

    result = accept_photo_evidence(
        session_id=session_id,
        step_id="front-main",
        pending_photo=PendingPhotoReview(
            image_bytes=b"\xff\xd8accepted-photo\xff\xd9",
            mime_type="image/jpeg",
            source_uri="file:///cache/front-main.jpg",
        ),
        guidance="Photo accepted. Moving to rear main.",
        visible_parts=[
            "front bumper",
            "bonnet line",
            "headlight",
            "front-left tyre",
        ],
    )

    assert result["type"] == "photo_acceptance"
    assert result["accepted"] is True
    assert result["completedStepId"] == "front-main"
    assert result["nextStep"]["id"] == "rear-main"
    assert result["session"]["plan"]["steps"][0]["status"] == "complete"
    assert result["session"]["plan"]["steps"][1]["status"] == "active"

    evidence_path = tmp_path / "evidence" / "sessions" / session_id / "photos" / "front-main.jpg"
    assert evidence_path.read_bytes() == b"\xff\xd8accepted-photo\xff\xd9"

    with sqlite3.connect(os.environ["INSPECTION_COPILOT_DB_PATH"]) as connection:
        connection.row_factory = sqlite3.Row
        evidence = connection.execute(
            """
            SELECT step_id, local_uri, accepted, metadata_json
            FROM evidence_items
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    assert evidence["step_id"] == "front-main"
    assert evidence["local_uri"] == str(evidence_path)
    assert evidence["accepted"] == 1
    assert json.loads(evidence["metadata_json"]) == {
        "imageBytes": len(b"\xff\xd8accepted-photo\xff\xd9"),
        "imageMimeType": "image/jpeg",
        "source": "saarthi-realtime-photo-review",
        "sourceUri": "file:///cache/front-main.jpg",
        "visibleParts": [
            "front bumper",
            "bonnet line",
            "headlight",
            "front-left tyre",
        ],
    }


def test_voice_accept_photo_handler_uses_pending_photo_and_notifies_mobile(tmp_path, monkeypatch):
    monkeypatch.setenv("INSPECTION_COPILOT_EVIDENCE_DIR", str(tmp_path / "evidence"))
    session_id = _create_started_session()
    sent_voice_results = []
    sent_tool_results = []
    tool_results = []

    def get_pending_photo(step_id: str):
        assert step_id == "front-main"
        return PendingPhotoReview(
            image_bytes=b"\xff\xd8voice-accepted-photo\xff\xd9",
            mime_type="image/jpeg",
            source_uri="file:///cache/review.jpg",
        )

    async def send_voice_result(result):
        sent_voice_results.append(result)

    async def send_tool_result(tool_call_id, result, create_response):
        sent_tool_results.append((tool_call_id, result, create_response))

    class Params:
        tool_call_id = "call_accept_photo"
        arguments = {
            "stepId": "front-main",
            "guidance": "Photo accepted. Moving to the next step.",
            "visibleParts": ["front bumper", "front-left tyre"],
        }

        async def result_callback(self, result):
            tool_results.append(result)

    handlers = build_voice_function_handlers(
        session_id,
        get_pending_photo=get_pending_photo,
        on_tool_result=send_tool_result,
        on_voice_result=send_voice_result,
    )

    asyncio.run(handlers["accept_photo"](Params()))

    assert tool_results[0]["type"] == "photo_acceptance"
    assert tool_results[0]["nextStep"]["id"] == "rear-main"
    assert sent_voice_results == tool_results
    assert sent_tool_results == [("call_accept_photo", tool_results[0], False)]


def test_voice_frame_handler_notifies_mobile_for_adjust_decision():
    session_id = _create_started_session()
    sent_messages = []
    sent_tool_results = []
    tool_results = []

    async def send_frame_intervention(message):
        sent_messages.append(message)

    async def send_tool_result(tool_call_id, result, create_response):
        sent_tool_results.append((tool_call_id, result, create_response))

    class Params:
        tool_call_id = "call_frame_adjust"
        arguments = {
            "stepId": "front-main",
            "status": "adjust",
            "guidance": "Camera car front par lao.",
            "confidence": 0.93,
            "visibleParts": [],
            "missingParts": ["front bumper"],
        }

        async def result_callback(self, result):
            tool_results.append(result)

    handlers = build_voice_function_handlers(
        session_id,
        on_frame_intervention=send_frame_intervention,
        on_tool_result=send_tool_result,
    )

    asyncio.run(handlers["record_frame_intervention"](Params()))

    assert tool_results == [
        {
            "type": "frame_intervention",
            "status": "adjust",
            "message": "Camera car front par lao.",
            "readyToCapture": False,
            "captureCommand": None,
        }
    ]
    assert sent_messages == tool_results
    assert sent_tool_results == [("call_frame_adjust", tool_results[0], False)]


def test_voice_handlers_do_not_expose_door_observation_tool():
    session_id = _create_started_session()
    handlers = build_voice_function_handlers(session_id)

    assert "record_door_observation" not in handlers


def test_voice_engine_handler_records_ai_interpreted_answers():
    session_id = _create_started_session()
    _capture_step(session_id, "front-main", "front-main-good")
    _capture_step(session_id, "rear-main", "rear-main-good")
    _capture_step(session_id, "dashboard-odometer", "dashboard-good")
    sent_voice_results = []
    sent_tool_results = []
    tool_results = []

    async def send_voice_result(result):
        sent_voice_results.append(result)

    async def send_tool_result(tool_call_id, result, create_response):
        sent_tool_results.append((tool_call_id, result, create_response))

    class Params:
        tool_call_id = "call_engine_observation"
        arguments = {
            "stepId": "engine-sound",
            "transcript": "I do not hear knocking or rattle. Slight shake, exhaust ok.",
            "knocking": "no",
            "rattling": "no",
            "idleVibration": "mild",
            "exhaustSound": "normal",
        }

        async def result_callback(self, result):
            tool_results.append(result)

    handlers = build_voice_function_handlers(
        session_id,
        on_tool_result=send_tool_result,
        on_voice_result=send_voice_result,
    )

    asyncio.run(handlers["record_engine_observation"](Params()))

    assert tool_results[0]["type"] == "engine"
    assert tool_results[0]["structuredFields"] == {
        "abnormalVibration": "mild at idle",
        "exhaustSound": "normal",
        "knocking": False,
        "rattling": False,
    }
    assert tool_results[0]["session"]["status"] == "ready_for_submission"
    assert sent_voice_results == tool_results
    assert sent_tool_results == [("call_engine_observation", tool_results[0], True)]


def test_realtime_bot_resolves_session_id_from_pipecat_runner_body():
    class RunnerArgs:
        body = {"sessionId": "insp_123", "languageCode": "hi-IN"}
        session_id = None

    assert resolve_runner_session_id(RunnerArgs()) == "insp_123"


def test_realtime_session_properties_enable_audio_output_and_tools():
    tools = build_voice_tools()

    properties = build_realtime_session_properties(
        instruction="Inspect the car.",
        language_code="hi-IN",
        tools=tools,
        voice="alloy",
    )

    assert properties.output_modalities == ["audio"]
    assert properties.audio.output.voice == "alloy"
    assert properties.audio.input.transcription.language == "hi"
    assert properties.tools == tools


def test_rtvi_observer_does_not_echo_hidden_seed_prompt_to_client():
    params = build_voice_rtvi_observer_params()

    assert params.user_llm_enabled is False


def test_voice_transcript_turn_rejects_photo_step_without_observation_step():
    session_id = _create_started_session()
    _capture_step(session_id, "front-main", "front-main-good")

    response = client.post(
        "/voice/transcript-turn",
        json={
            "sessionId": session_id,
            "stepId": "front-main",
            "transcript": "Minor scratch near the handle, no dent.",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Step does not require a spoken observation"

    with sqlite3.connect(os.environ["INSPECTION_COPILOT_DB_PATH"]) as connection:
        row = connection.execute(
            """
            SELECT step_id
            FROM structured_observations
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    assert row is None


def test_voice_record_engine_observation_marks_session_ready_for_submission():
    session_id = _create_started_session()
    _capture_step(session_id, "front-main", "front-main-good")
    _capture_step(session_id, "rear-main", "rear-main-good")
    _capture_step(session_id, "dashboard-odometer", "dashboard-good")

    result = record_voice_observation(
        answers={
            "knocking": "no",
            "rattling": "no",
            "idleVibration": "mild",
            "exhaustSound": "normal",
        },
        session_id=session_id,
        step_id="engine-sound",
        transcript="Inspector reported no unusual sound, mild shake, normal exhaust.",
    )

    assert result["type"] == "engine"
    assert result["structuredFields"] == {
        "abnormalVibration": "mild at idle",
        "exhaustSound": "normal",
        "knocking": False,
        "rattling": False,
    }
    assert result["session"]["status"] == "ready_for_submission"
