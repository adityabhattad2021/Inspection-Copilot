import os
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.database import clear_database, seed_database
from app.main import app


client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_sqlite_db(monkeypatch, tmp_path):
    monkeypatch.setenv("JOCKEY_COPILOT_DB_PATH", str(tmp_path / "inspection.db"))
    clear_database()
    seed_database()


def _create_session() -> str:
    response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )
    assert response.status_code == 201
    return response.json()["sessionId"]


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


def test_start_session_marks_first_step_active_and_returns_agent_greeting():
    session_id = _create_session()

    response = client.post(
        f"/sessions/{session_id}/start",
        json={"jockeyName": "Aditya", "languageCode": "hi-IN"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["session"]["status"] == "active"
    assert body["activeStep"]["id"] == "front-main"
    assert body["session"]["plan"]["steps"][0]["status"] == "active"
    assert "2020 Hyundai Creta" in body["agentMessage"]
    assert "Front Main" in body["agentMessage"]


def test_live_frame_analysis_returns_guidance_and_records_intervention():
    session_id = _create_session()
    client.post(f"/sessions/{session_id}/start", json={})

    response = client.post(
        "/ai/analyze-live-frame",
        json={
            "sessionId": session_id,
            "stepId": "front-main",
            "sampleKey": "front-main-bad-cropped",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "adjust"
    assert body["readyToCapture"] is False
    assert body["confidence"] == 0.78
    assert "front-left tyre" in body["guidance"]

    with sqlite3.connect(os.environ["JOCKEY_COPILOT_DB_PATH"]) as connection:
        row = connection.execute(
            """
            SELECT step_id, type, message
            FROM ai_interventions
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    assert row == (
        "front-main",
        "live_frame_adjust",
        body["guidance"],
    )


def test_live_frame_analysis_rejects_unrecognized_frame_without_fallback():
    session_id = _create_session()
    client.post(f"/sessions/{session_id}/start", json={})

    response = client.post(
        "/ai/analyze-live-frame",
        json={
            "sessionId": session_id,
            "stepId": "front-main",
            "sampleKey": "unknown-frame",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Unrecognized live frame input"


def test_photo_evidence_accepts_step_and_advances_to_lhs_door():
    session_id = _create_session()
    client.post(f"/sessions/{session_id}/start", json={})

    response = client.post(
        "/ai/analyze-live-frame",
        json={
            "sessionId": session_id,
            "stepId": "front-main",
            "sampleKey": "front-main-good",
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "hold"
    assert response.json()["readyToCapture"] is True

    body = _capture_step(session_id, "front-main", "front-main-good")

    assert body["accepted"] is True
    assert body["completedStepId"] == "front-main"
    assert body["nextStep"]["id"] == "lhs-front-door"
    assert body["session"]["plan"]["steps"][0]["status"] == "complete"
    assert body["session"]["plan"]["steps"][1]["status"] == "active"

    with sqlite3.connect(os.environ["JOCKEY_COPILOT_DB_PATH"]) as connection:
        row = connection.execute(
            """
            SELECT step_id, kind, local_uri, accepted
            FROM evidence_items
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    assert row == ("front-main", "photo", "sample://front-main-good", 1)


def test_structure_observation_saves_lhs_door_damage_and_advances():
    session_id = _create_session()
    client.post(f"/sessions/{session_id}/start", json={})
    _capture_step(session_id, "front-main", "front-main-good")
    _capture_step(session_id, "lhs-front-door", "lhs-door-scratch")

    response = client.post(
        "/ai/structure-observation",
        json={
            "sessionId": session_id,
            "stepId": "lhs-front-door",
            "transcript": "Minor scratch near the handle, no dent.",
        },
    )

    assert response.status_code == 200
    body = response.json()
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


def test_engine_check_completes_final_step_and_session_complete_thanks_agent():
    session_id = _create_session()
    client.post(f"/sessions/{session_id}/start", json={})
    _capture_step(session_id, "front-main", "front-main-good")
    _capture_step(session_id, "lhs-front-door", "lhs-door-scratch")
    client.post(
        "/ai/structure-observation",
        json={
            "sessionId": session_id,
            "stepId": "lhs-front-door",
            "transcript": "Minor scratch near the handle, no dent.",
        },
    )
    _capture_step(session_id, "rear-main", "rear-main-good")
    _capture_step(session_id, "dashboard-odometer", "dashboard-good")

    engine_response = client.post(
        "/ai/engine-check",
        json={
            "sessionId": session_id,
            "stepId": "engine-sound",
            "phase": "final",
            "transcript": "No knocking. Mild vibration at idle. Exhaust sounds normal.",
        },
    )

    assert engine_response.status_code == 200
    engine_body = engine_response.json()
    assert engine_body["isComplete"] is True
    assert engine_body["structuredFields"] == {
        "abnormalVibration": "mild at idle",
        "exhaustSound": "normal",
        "knocking": False,
        "rattling": False,
    }
    assert engine_body["session"]["status"] == "ready_for_submission"

    complete_response = client.post(f"/sessions/{session_id}/complete")

    assert complete_response.status_code == 200
    complete_body = complete_response.json()
    assert complete_body["status"] == "completed"
    assert complete_body["completedStepCount"] == 5
    assert "Thank you" in complete_body["agentMessage"]
