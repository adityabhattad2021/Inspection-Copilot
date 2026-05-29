import os
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.database import clear_database, seed_database
from app.main import app


client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_sqlite_db(monkeypatch, tmp_path):
    monkeypatch.setenv("JOCKEY_COPILOT_DB_PATH", str(tmp_path / "sessions.db"))
    clear_database()
    seed_database()


def test_health_returns_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_vehicle_lookup_returns_demo_vehicle_with_camel_case_fields():
    response = client.post(
        "/vehicles/lookup",
        json={"registrationNumber": " ka 03 mx 2147 "},
    )

    assert response.status_code == 200
    assert response.json() == {
        "registrationNumber": "KA03MX2147",
        "make": "Hyundai",
        "model": "Creta",
        "year": 2020,
        "variant": "SX",
        "fuelType": "Petrol",
        "transmission": "Automatic",
        "bodyType": "SUV",
        "registrationCity": "Bengaluru",
        "registrationState": "Karnataka",
    }


def test_list_vehicles_returns_seeded_vehicles():
    response = client.get("/vehicles")

    assert response.status_code == 200
    body = response.json()
    assert [vehicle["registrationNumber"] for vehicle in body["vehicles"]] == [
        "KA03MX2147",
        "KA05NB7777",
        "DL8CAF5031",
    ]
    assert body["vehicles"][0]["make"] == "Hyundai"


def test_vehicle_lookup_rejects_unknown_demo_registration():
    response = client.post(
        "/vehicles/lookup",
        json={"registrationNumber": "KA00AA0000"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Unknown demo registration"


def test_create_session_returns_vehicle_and_four_step_plan():
    response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["sessionId"].startswith("insp_")
    assert body["status"] == "created"
    assert body["vehicle"]["registrationNumber"] == "KA03MX2147"
    assert body["plan"]["name"] == "SUV Petrol Automatic Inspection Plan"
    assert [step["id"] for step in body["plan"]["steps"]] == [
        "front-main",
        "rear-main",
        "dashboard-odometer",
        "engine-sound",
    ]
    assert body["plan"]["steps"][0]["autoCapture"] == {
        "enabled": True,
        "holdMs": 1200,
    }


def test_create_session_persists_session_to_local_sqlite():
    response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )
    body = response.json()
    db_path = os.environ["JOCKEY_COPILOT_DB_PATH"]

    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT session_id, status, registration_number
            FROM inspection_sessions
            WHERE session_id = ?
            """,
            (body["sessionId"],),
        ).fetchone()

    assert row == (body["sessionId"], "created", "KA03MX2147")


def test_create_session_persists_snapshot_of_seeded_plan_steps():
    response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )
    body = response.json()
    db_path = os.environ["JOCKEY_COPILOT_DB_PATH"]

    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT step_id, status, sort_order
            FROM inspection_session_steps
            WHERE session_id = ?
            ORDER BY sort_order
            """,
            (body["sessionId"],),
        ).fetchall()

    assert rows == [
        ("front-main", "pending", 1),
        ("rear-main", "pending", 2),
        ("dashboard-odometer", "pending", 3),
        ("engine-sound", "pending", 4),
    ]


def test_get_session_returns_existing_persisted_session():
    create_response = client.post(
        "/sessions",
        json={"registrationNumber": "KA03MX2147"},
    )
    session_id = create_response.json()["sessionId"]

    get_response = client.get(f"/sessions/{session_id}")

    assert get_response.status_code == 200
    assert get_response.json() == create_response.json()


def test_get_session_rejects_unknown_session_id():
    response = client.get("/sessions/insp_missing")

    assert response.status_code == 404
    assert response.json()["detail"] == "Inspection session not found"


def test_create_profile_persists_jockey_profile_to_local_sqlite():
    response = client.post(
        "/profiles",
        json={"name": " Aditya ", "languageCode": "kn-IN"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["profileId"].startswith("jockey_")
    assert body["name"] == "Aditya"
    assert body["languageCode"] == "kn-IN"
    assert body["languageLabel"] == "Kannada"
    assert body["createdAt"].endswith("Z")
    assert body["updatedAt"] == body["createdAt"]

    db_path = os.environ["JOCKEY_COPILOT_DB_PATH"]
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT profile_id, name, language_code, language_label
            FROM jockey_profiles
            WHERE profile_id = ?
            """,
            (body["profileId"],),
        ).fetchone()

    assert row == (
        body["profileId"],
        "Aditya",
        "kn-IN",
        "Kannada",
    )


def test_get_profile_returns_existing_jockey_profile():
    create_response = client.post(
        "/profiles",
        json={"name": "Ravi", "languageCode": "hi-IN"},
    )
    profile_id = create_response.json()["profileId"]

    get_response = client.get(f"/profiles/{profile_id}")

    assert get_response.status_code == 200
    assert get_response.json() == create_response.json()


def test_list_profiles_returns_all_created_jockey_profiles():
    first_response = client.post(
        "/profiles",
        json={"name": "Ravi", "languageCode": "hi-IN"},
    )
    second_response = client.post(
        "/profiles",
        json={"name": "Asha", "languageCode": "kn-IN"},
    )

    response = client.get("/profiles")

    assert response.status_code == 200
    body = response.json()
    assert body["profiles"] == [
        first_response.json(),
        second_response.json(),
    ]


def test_create_profile_rejects_unsupported_language_code():
    response = client.post(
        "/profiles",
        json={"name": "Ravi", "languageCode": "fr-FR"},
    )

    assert response.status_code == 422


def test_get_profile_rejects_unknown_profile_id():
    response = client.get("/profiles/jockey_missing")

    assert response.status_code == 404
    assert response.json()["detail"] == "Jockey profile not found"
