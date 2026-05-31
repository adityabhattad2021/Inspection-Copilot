import importlib

from fastapi.testclient import TestClient


def test_database_uses_dynamodb_backend_when_configured(monkeypatch):
    monkeypatch.setenv("INSPECTION_COPILOT_STORAGE_BACKEND", "dynamodb")
    monkeypatch.setenv("INSPECTION_COPILOT_DDB_TABLE", "inspection-copilot")

    import app.database as database

    database = importlib.reload(database)

    try:
        assert database.get_vehicle.__module__ == "app.database.dynamodb_backend"
        assert database.save_session_payload.__module__ == "app.database.dynamodb_backend"
    finally:
        monkeypatch.setenv("INSPECTION_COPILOT_STORAGE_BACKEND", "sqlite")
        importlib.reload(database)


def test_s3_photo_object_key():
    from app.storage.s3_store import photo_object_key

    assert (
        photo_object_key("insp_123", "front-main")
        == "sessions/insp_123/photos/front-main.jpg"
    )


def test_uploads_presign_returns_s3_shape(monkeypatch):
    from app.main import app
    from app.routes import uploads

    monkeypatch.setenv("INSPECTION_COPILOT_S3_BUCKET", "inspection-copilot-evidence-test")
    monkeypatch.setattr(
        uploads,
        "create_presigned_upload_url",
        lambda *, bucket, object_key, content_type, expires_in: (
            f"https://example.test/{object_key}?signature=fake"
        ),
    )

    client = TestClient(app)
    response = client.post(
        "/uploads/presign",
        json={
            "sessionId": "insp_123",
            "stepId": "front-main",
            "kind": "photo",
            "contentType": "image/jpeg",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "uploadUrl": (
            "https://example.test/sessions/insp_123/photos/front-main.jpg"
            "?signature=fake"
        ),
        "objectKey": "sessions/insp_123/photos/front-main.jpg",
        "expiresIn": 900,
    }
