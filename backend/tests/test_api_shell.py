from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


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


def test_vehicle_lookup_rejects_unknown_demo_registration():
    response = client.post(
        "/vehicles/lookup",
        json={"registrationNumber": "KA00AA0000"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Unknown demo registration"


def test_create_session_returns_vehicle_and_five_step_plan():
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
        "lhs-front-door",
        "dashboard-odometer",
        "engine-sound",
    ]
    assert body["plan"]["steps"][0]["autoCapture"] == {
        "enabled": True,
        "holdMs": 1200,
    }


def test_get_session_returns_existing_in_memory_session():
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
