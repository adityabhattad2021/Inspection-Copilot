import json

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_debug_inspection_flow_log_appends_ndjson_to_local_file(monkeypatch, tmp_path):
    log_path = tmp_path / "debug" / "inspection-flow.ndjson"
    monkeypatch.setenv("JOCKEY_COPILOT_FLOW_LOG_PATH", str(log_path))

    response = client.post(
        "/debug/inspection-flow-log",
        json={
            "event": "screen_view",
            "sessionId": "insp_debug123",
            "screen": "realtime_camera",
            "stepId": "front-main",
            "payload": {
                "instruction": "Good. Hold still.",
                "showing": {
                    "stepTitle": "Front Main",
                    "status": "active",
                },
            },
        },
    )

    assert response.status_code == 202
    assert response.json() == {"status": "logged"}

    session_log_path = log_path.parent / "inspection-flow" / "insp_debug123.ndjson"
    lines = session_log_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1

    entry = json.loads(lines[0])
    assert entry["event"] == "screen_view"
    assert entry["sessionId"] == "insp_debug123"
    assert entry["screen"] == "realtime_camera"
    assert entry["stepId"] == "front-main"
    assert entry["payload"] == {
        "instruction": "Good. Hold still.",
        "showing": {
            "stepTitle": "Front Main",
            "status": "active",
        },
    }
    assert entry["loggedAt"].endswith("Z")


def test_debug_inspection_flow_log_keeps_appending_events(monkeypatch, tmp_path):
    log_path = tmp_path / "inspection-flow.ndjson"
    monkeypatch.setenv("JOCKEY_COPILOT_FLOW_LOG_PATH", str(log_path))

    first = client.post(
        "/debug/inspection-flow-log",
        json={"event": "user_transcript", "payload": {"text": "Minor scratch"}},
    )
    second = client.post(
        "/debug/inspection-flow-log",
        json={"event": "agent_message", "payload": {"text": "Move left"}},
    )

    assert first.status_code == 202
    assert second.status_code == 202

    entries = [
        json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines()
    ]
    assert [entry["event"] for entry in entries] == [
        "user_transcript",
        "agent_message",
    ]


def test_debug_inspection_flow_log_creates_one_file_per_session(monkeypatch, tmp_path):
    log_path = tmp_path / "inspection-flow.ndjson"
    monkeypatch.setenv("JOCKEY_COPILOT_FLOW_LOG_PATH", str(log_path))

    first = client.post(
        "/debug/inspection-flow-log",
        json={
            "event": "agent_message",
            "sessionId": "insp_first",
            "payload": {"text": "Move left"},
        },
    )
    second = client.post(
        "/debug/inspection-flow-log",
        json={
            "event": "agent_message",
            "sessionId": "insp_second",
            "payload": {"text": "Good. Hold still."},
        },
    )
    third = client.post(
        "/debug/inspection-flow-log",
        json={
            "event": "capture_saved",
            "sessionId": "insp_first",
            "payload": {"stepId": "front-main"},
        },
    )

    assert first.status_code == 202
    assert second.status_code == 202
    assert third.status_code == 202

    first_log_path = log_path.parent / "inspection-flow" / "insp_first.ndjson"
    second_log_path = log_path.parent / "inspection-flow" / "insp_second.ndjson"

    first_entries = [
        json.loads(line) for line in first_log_path.read_text(encoding="utf-8").splitlines()
    ]
    second_entries = [
        json.loads(line)
        for line in second_log_path.read_text(encoding="utf-8").splitlines()
    ]

    assert [entry["event"] for entry in first_entries] == [
        "agent_message",
        "capture_saved",
    ]
    assert [entry["event"] for entry in second_entries] == ["agent_message"]
