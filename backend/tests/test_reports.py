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
    monkeypatch.setenv("JOCKEY_COPILOT_EVIDENCE_DIR", str(tmp_path / "evidence"))
    clear_database()
    seed_database()


def _create_completed_session() -> str:
    create_response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )
    assert create_response.status_code == 201
    session_id = create_response.json()["sessionId"]
    client.post(f"/sessions/{session_id}/start", json={})

    for step_id, sample_key in [
        ("front-main", "front-main-good"),
        ("rear-main", "rear-main-good"),
        ("dashboard-odometer", "dashboard-good"),
    ]:
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

    engine_response = client.post(
        "/ai/engine-check",
        json={
            "sessionId": session_id,
            "stepId": "engine-sound",
            "phase": "final",
            "answers": {
                "knocking": "no",
                "rattling": "no",
                "idleVibration": "mild",
                "exhaustSound": "normal",
            },
        },
    )
    assert engine_response.status_code == 200
    return session_id


def test_complete_session_generates_report_links_and_persists_json():
    session_id = _create_completed_session()

    response = client.post(f"/sessions/{session_id}/complete")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["report"] == {
        "reportId": body["report"]["reportId"],
        "sessionId": session_id,
        "status": "ready",
        "completionScore": 1.0,
        "mediaQualityScore": 0.93,
        "pricingRisk": "medium",
        "reportJsonUrl": f"/sessions/{session_id}/report",
        "reportHtmlUrl": f"/sessions/{session_id}/report.html",
        "downloadUrl": f"/sessions/{session_id}/report.html",
        "createdAt": body["report"]["createdAt"],
        "updatedAt": body["report"]["updatedAt"],
    }
    assert body["report"]["reportId"].startswith("rpt_")

    with sqlite3.connect(os.environ["JOCKEY_COPILOT_DB_PATH"]) as connection:
        row = connection.execute(
            """
            SELECT status, completion_score, media_quality_score, pricing_risk
            FROM reports
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    assert row == ("ready", 1.0, 0.93, "medium")


def test_get_report_returns_json_for_dashboard_population():
    session_id = _create_completed_session()
    client.post(f"/sessions/{session_id}/complete")

    response = client.get(f"/sessions/{session_id}/report")

    assert response.status_code == 200
    body = response.json()
    assert body["sessionId"] == session_id
    assert body["vehicle"]["registrationNumber"] == "KA03MX2147"
    assert body["summary"]["completedStepCount"] == 4
    assert body["summary"]["totalStepCount"] == 4
    assert body["summary"]["completionScore"] == 1.0
    assert body["summary"]["mediaQualityScore"] == 0.93
    assert body["summary"]["pricingRisk"] == "medium"
    assert [item["stepId"] for item in body["evidence"]] == [
        "front-main",
        "rear-main",
        "dashboard-odometer",
    ]
    assert body["observations"][0]["stepId"] == "engine-sound"
    assert body["observations"][0]["structuredFields"]["abnormalVibration"] == (
        "mild at idle"
    )


def test_create_report_endpoint_generates_report_after_steps_complete():
    session_id = _create_completed_session()

    response = client.post(f"/sessions/{session_id}/report")

    assert response.status_code == 200
    body = response.json()
    assert body["sessionId"] == session_id
    assert body["status"] == "ready"
    assert body["reportJsonUrl"] == f"/sessions/{session_id}/report"
    assert body["downloadUrl"] == f"/sessions/{session_id}/report.html"

    report_response = client.get(body["reportJsonUrl"])
    assert report_response.status_code == 200
    assert report_response.json()["reportId"] == body["reportId"]


def test_get_report_html_returns_downloadable_html():
    session_id = _create_completed_session()
    client.post(f"/sessions/{session_id}/complete")

    response = client.get(f"/sessions/{session_id}/report.html")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert (
        response.headers["content-disposition"]
        == f'attachment; filename="inspection-report-{session_id}.html"'
    )
    assert "AI Inspection Quality Report" in response.text
    assert "KA03MX2147" in response.text
    assert "Mild Vibration" in response.text


def test_create_report_rejects_incomplete_session():
    create_response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )
    session_id = create_response.json()["sessionId"]

    response = client.post(f"/sessions/{session_id}/report")

    assert response.status_code == 409
    assert response.json()["detail"] == "Inspection has pending steps"
