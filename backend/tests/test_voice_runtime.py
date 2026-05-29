import json
import os
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.database import clear_database, seed_database
from app.main import app
from app.voice.config import get_voice_runtime_config
from app.voice.prompts import build_realtime_instruction
from app.voice.realtime_bot import (
    build_inspection_control_ack,
    build_inspection_control_error,
    build_initial_realtime_messages,
    build_realtime_session_properties,
    build_realtime_text_events,
    build_voice_transport_params,
    build_voice_rtvi_observer_params,
    resolve_runner_session_id,
)
from app.voice.tools import (
    build_voice_tools,
    record_frame_intervention,
    record_voice_observation,
)


client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_sqlite_db(monkeypatch, tmp_path):
    monkeypatch.setenv("JOCKEY_COPILOT_DB_PATH", str(tmp_path / "voice.db"))
    monkeypatch.setenv("JOCKEY_COPILOT_ENV_FILE", str(tmp_path / "missing.env"))
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_REALTIME_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_REALTIME_VOICE", raising=False)
    monkeypatch.delenv("JOCKEY_COPILOT_VOICE_BASE_URL", raising=False)
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
        json={"jockeyName": "Aditya", "languageCode": "hi-IN"},
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


def test_voice_config_exposes_pipecat_start_url_without_requiring_mobile_secret(
    monkeypatch,
):
    response = client.get("/voice/config")

    assert response.status_code == 200
    body = response.json()
    assert body == {
        "provider": "pipecat",
        "transport": "small-webrtc",
        "startUrl": "http://localhost:8000/start",
        "model": "gpt-realtime-2",
        "voice": "alloy",
        "ready": False,
        "missing": ["OPENAI_API_KEY"],
    }


def test_voice_config_loads_openai_key_from_backend_env_file(monkeypatch, tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "OPENAI_API_KEY=sk-test-local",
                "OPENAI_REALTIME_MODEL=gpt-realtime-local",
                "OPENAI_REALTIME_VOICE=ash",
                "JOCKEY_COPILOT_VOICE_BASE_URL=http://127.0.0.1:8787",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("JOCKEY_COPILOT_ENV_FILE", str(env_file))

    config = get_voice_runtime_config()

    assert config.ready is True
    assert config.missing == []
    assert config.model == "gpt-realtime-local"
    assert config.voice == "ash"
    assert config.start_url == "http://127.0.0.1:8787/start"


def test_voice_start_endpoint_runs_on_the_main_fastapi_app():
    response = client.post(
        "/start",
        json={"body": {"sessionId": "insp_local", "languageCode": "hi-IN"}},
    )

    assert response.status_code == 200
    assert response.json()["sessionId"]


def test_realtime_instruction_includes_vehicle_step_language_and_guardrails():
    session_id = _create_started_session()
    session = client.get(f"/sessions/{session_id}").json()

    instruction = build_realtime_instruction(
        session=session,
        jockey_name="Aditya",
        language_code="hi-IN",
    )

    assert "Cars24 Jockey Copilot" in instruction
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
    assert "camera frames" in instruction
    assert "record_frame_intervention" in instruction
    assert "Do not diagnose mechanical condition from audio" in instruction
    assert "SYSTEM_GUIDANCE:" in instruction
    assert "SYSTEM_EVENT:" in instruction


def test_realtime_bot_starts_with_immediate_greeting_turn():
    messages = build_initial_realtime_messages(
        "You are Cars24 Jockey Copilot. Speak Hindi."
    )

    assert messages[0] == {
        "role": "system",
        "content": "You are Cars24 Jockey Copilot. Speak Hindi.",
    }
    assert messages[1]["role"] == "user"
    assert "short opening greeting" in messages[1]["content"]
    assert "Saarthi" in messages[1]["content"]
    assert "inspection navigator" in messages[1]["content"]
    assert "Localize naturally" in messages[1]["content"]
    assert "English radio phrases" in messages[1]["content"]
    assert "Do not mention any inspection step" in messages[1]["content"]
    assert "first inspection step" not in messages[1]["content"]


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
        "record_frame_intervention",
        "record_door_observation",
        "record_engine_observation",
        "complete_inspection",
    ]


def test_voice_transport_params_enable_realtime_camera_input():
    params = build_voice_transport_params()

    assert params.audio_in_enabled is True
    assert params.audio_out_enabled is True
    assert params.video_in_enabled is True
    assert params.audio_in_sample_rate == 24000
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

    with sqlite3.connect(os.environ["JOCKEY_COPILOT_DB_PATH"]) as connection:
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


def test_voice_transcript_turn_saves_lhs_observation_and_advances_session():
    session_id = _create_started_session()
    _capture_step(session_id, "front-main", "front-main-good")
    _capture_step(session_id, "lhs-front-door", "lhs-door-scratch")

    response = client.post(
        "/voice/transcript-turn",
        json={
            "sessionId": session_id,
            "stepId": "lhs-front-door",
            "transcript": "Minor scratch near the handle, no dent.",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "observation"
    assert body["structuredFields"] == {
        "dent": False,
        "issue": "scratch",
        "severity": "minor",
    }
    assert body["nextStep"]["id"] == "rear-main"
    assert body["session"]["plan"]["steps"][1]["status"] == "complete"
    assert body["session"]["plan"]["steps"][2]["status"] == "active"

    with sqlite3.connect(os.environ["JOCKEY_COPILOT_DB_PATH"]) as connection:
        row = connection.execute(
            """
            SELECT step_id, issue, severity
            FROM structured_observations
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    assert row == ("lhs-front-door", "scratch", "minor")


def test_voice_record_engine_observation_marks_session_ready_for_submission():
    session_id = _create_started_session()
    _capture_step(session_id, "front-main", "front-main-good")
    _capture_step(session_id, "lhs-front-door", "lhs-door-scratch")
    record_voice_observation(
        session_id=session_id,
        step_id="lhs-front-door",
        transcript="Minor scratch near the handle, no dent.",
    )
    _capture_step(session_id, "rear-main", "rear-main-good")
    _capture_step(session_id, "dashboard-odometer", "dashboard-good")

    result = record_voice_observation(
        session_id=session_id,
        step_id="engine-sound",
        transcript="No knocking. Mild vibration at idle. Exhaust sounds normal.",
    )

    assert result["type"] == "engine"
    assert result["structuredFields"] == {
        "abnormalVibration": "mild at idle",
        "exhaustSound": "normal",
        "knocking": False,
        "rattling": False,
    }
    assert result["session"]["status"] == "ready_for_submission"
