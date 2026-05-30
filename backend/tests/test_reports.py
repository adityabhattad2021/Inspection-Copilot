import os
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.database import clear_database, seed_database, save_report_payload
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
    assert body["evidence"][0]["imageUrl"].startswith(
        f"/sessions/{session_id}/evidence/"
    )


def test_report_json_includes_demo_ready_insights_and_badges():
    session_id = _create_completed_session()
    client.post(f"/sessions/{session_id}/complete")

    response = client.get(f"/sessions/{session_id}/report")

    assert response.status_code == 200
    body = response.json()
    presentation = body["presentation"]
    assert presentation["headline"].startswith("Pricing review recommended")
    assert presentation["evidenceSummary"] == {
        "acceptedEvidenceCount": 3,
        "expectedEvidenceCount": 3,
        "isComplete": True,
        "missingStepIds": [],
        "retakeCount": 0,
    }
    assert {badge["label"] for badge in presentation["badges"]} == {
        "Needs review",
        "Evidence complete",
    }
    assert presentation["engineSummary"]["severity"] == "minor"
    assert any(
        "mild vibration" in note.casefold()
        for note in presentation["pricingNotes"]
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
    assert "Needs review" in response.text
    assert "Evidence complete" in response.text
    assert "Pricing review" in response.text
    assert "Engine inspection" in response.text
    assert "Evidence photos" in response.text
    assert f'src="/sessions/{session_id}/evidence/' in response.text


def test_get_report_html_view_renders_inline_with_download_action():
    session_id = _create_completed_session()
    client.post(f"/sessions/{session_id}/complete")

    response = client.get(f"/sessions/{session_id}/report.html?view=1")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "content-disposition" not in response.headers
    assert "Download HTML" in response.text
    assert f'href="/sessions/{session_id}/report.html"' in response.text
    assert "JetBrains Mono" in response.text
    assert "#F6F7F2" in response.text
    assert "#D7F85C" in response.text


def test_report_evidence_image_endpoint_serves_uploaded_photo():
    create_response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )
    session_id = create_response.json()["sessionId"]
    client.post(f"/sessions/{session_id}/start", json={})
    photo_response = client.post(
        "/evidence/photo",
        data={
            "sessionId": session_id,
            "stepId": "front-main",
            "sampleKey": "front-main-good",
        },
        files={"image": ("front-main.jpg", b"fake-jpeg-bytes", "image/jpeg")},
    )
    assert photo_response.status_code == 200
    evidence_id = photo_response.json()["evidenceId"]

    response = client.get(f"/sessions/{session_id}/evidence/{evidence_id}")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/jpeg")
    assert response.content == b"fake-jpeg-bytes"


def test_create_report_rejects_incomplete_session():
    create_response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )
    session_id = create_response.json()["sessionId"]

    response = client.post(f"/sessions/{session_id}/report")

    assert response.status_code == 409
    assert response.json()["detail"] == "Inspection has pending steps"


def test_admin_reports_reject_missing_or_invalid_token(monkeypatch):
    monkeypatch.setenv("JOCKEY_COPILOT_ADMIN_TOKEN", "demo-secret")

    missing_response = client.get("/admin/reports.json")
    invalid_response = client.get(
        "/admin/reports.json",
        headers={"Authorization": "Bearer nope"},
    )

    assert missing_response.status_code == 401
    assert invalid_response.status_code == 401


def test_admin_reports_list_generated_reports_with_badges(monkeypatch):
    monkeypatch.setenv("JOCKEY_COPILOT_ADMIN_TOKEN", "demo-secret")
    session_id = _create_completed_session()
    client.post(f"/sessions/{session_id}/complete")

    response = client.get("/admin/reports.json?token=demo-secret")

    assert response.status_code == 200
    body = response.json()
    assert body["reports"][0]["sessionId"] == session_id
    assert body["reports"][0]["vehicle"]["registrationNumber"] == "KA03MX2147"
    assert body["reports"][0]["badge"]["label"] == "Needs review"
    assert body["reports"][0]["evidenceBadge"]["label"] == "Evidence complete"
    assert body["reports"][0]["reportViewUrl"] == (
        f"/sessions/{session_id}/report.html?view=1"
    )
    assert body["reports"][0]["reportHtmlUrl"] == f"/sessions/{session_id}/report.html"


def test_admin_reports_derives_badges_for_legacy_report_payloads(monkeypatch):
    monkeypatch.setenv("JOCKEY_COPILOT_ADMIN_TOKEN", "demo-secret")
    session_id = _create_completed_session()
    save_report_payload(
        {
            "reportId": "rpt_legacy",
            "sessionId": session_id,
            "status": "ready",
            "completionScore": 1.0,
            "mediaQualityScore": 0.93,
            "pricingRisk": "low",
            "reportHtmlPath": f"/sessions/{session_id}/report.html",
            "createdAt": "2026-05-30T10:00:00Z",
            "updatedAt": "2026-05-30T10:00:00Z",
            "reportJson": {
                "reportId": "rpt_legacy",
                "sessionId": session_id,
                "generatedAt": "2026-05-30T10:00:00Z",
                "vehicle": {"registrationNumber": "KA03MX2147"},
                "summary": {
                    "acceptedEvidenceCount": 3,
                    "completionScore": 1.0,
                    "mediaQualityScore": 0.93,
                    "pricingRisk": "low",
                    "retakeCount": 0,
                },
                "steps": [
                    {"kind": "photo", "status": "complete", "stepId": "front-main"},
                    {"kind": "photo", "status": "complete", "stepId": "rear-main"},
                    {
                        "kind": "photo",
                        "status": "complete",
                        "stepId": "dashboard-odometer",
                    },
                    {
                        "kind": "engine-guided",
                        "status": "complete",
                        "stepId": "engine-sound",
                    },
                ],
                "evidence": [
                    {"accepted": True, "kind": "photo", "stepId": "front-main"},
                    {"accepted": True, "kind": "photo", "stepId": "rear-main"},
                    {
                        "accepted": True,
                        "kind": "photo",
                        "stepId": "dashboard-odometer",
                    },
                ],
            },
        }
    )

    response = client.get("/admin/reports.json?token=demo-secret")

    assert response.status_code == 200
    report = response.json()["reports"][0]
    assert report["badge"]["label"] == "Low pricing risk"
    assert report["evidenceBadge"]["label"] == "Evidence complete"
    assert report["expectedEvidenceCount"] == 3


def test_legacy_report_html_uses_derived_insights_without_failing():
    session_id = _create_completed_session()
    save_report_payload(
        {
            "reportId": "rpt_legacy",
            "sessionId": session_id,
            "status": "ready",
            "completionScore": 1.0,
            "mediaQualityScore": 0.93,
            "pricingRisk": "low",
            "reportHtmlPath": f"/sessions/{session_id}/report.html",
            "createdAt": "2026-05-30T10:00:00Z",
            "updatedAt": "2026-05-30T10:00:00Z",
            "reportJson": {
                "reportId": "rpt_legacy",
                "sessionId": session_id,
                "generatedAt": "2026-05-30T10:00:00Z",
                "vehicle": {
                    "registrationNumber": "KA03MX2147",
                    "year": 2020,
                    "make": "Hyundai",
                    "model": "Creta",
                    "variant": "SX",
                },
                "summary": {
                    "acceptedEvidenceCount": 3,
                    "completionScore": 1.0,
                    "mediaQualityScore": 0.93,
                    "pricingRisk": "low",
                    "retakeCount": 0,
                },
                "steps": [
                    {"fieldName": "Front Main", "kind": "photo", "section": "Exterior & Tyres", "status": "complete", "stepId": "front-main"},
                    {"fieldName": "Rear Main", "kind": "photo", "section": "Exterior & Tyres", "status": "complete", "stepId": "rear-main"},
                    {"fieldName": "Dashboard", "kind": "photo", "section": "Interior", "status": "complete", "stepId": "dashboard-odometer"},
                    {"fieldName": "Engine sound", "kind": "engine-guided", "section": "Engine", "status": "complete", "stepId": "engine-sound"},
                ],
                "evidence": [
                    {"accepted": True, "kind": "photo", "qualityScore": 0.93, "stepId": "front-main"},
                    {"accepted": True, "kind": "photo", "qualityScore": 0.93, "stepId": "rear-main"},
                    {"accepted": True, "kind": "photo", "qualityScore": 0.93, "stepId": "dashboard-odometer"},
                ],
                "observations": [],
                "aiInterventions": [],
                "auditTrail": [],
            },
        }
    )

    response = client.get(f"/sessions/{session_id}/report.html")

    assert response.status_code == 200
    assert "Low pricing risk" in response.text
    assert "Evidence complete" in response.text


def test_admin_dashboard_serves_react_shell_for_valid_token(monkeypatch):
    monkeypatch.setenv("JOCKEY_COPILOT_ADMIN_TOKEN", "demo-secret")

    response = client.get("/admin/reports?token=demo-secret")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Reports Admin" in response.text
    assert "React.createElement" in response.text
    assert "reportViewUrl" in response.text
    assert "Download" in response.text
    assert "JetBrains Mono" in response.text
    assert "#F6F7F2" in response.text
    assert "#D7F85C" in response.text
    assert "#101820" in response.text
