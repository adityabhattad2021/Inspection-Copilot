import os
import sqlite3

from app.database import clear_database, seed_database


def test_seed_database_creates_full_local_schema(monkeypatch, tmp_path):
    monkeypatch.setenv("JOCKEY_COPILOT_DB_PATH", str(tmp_path / "seed.db"))

    clear_database()
    seed_database()

    with sqlite3.connect(os.environ["JOCKEY_COPILOT_DB_PATH"]) as connection:
        table_names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }

    assert {
        "vehicles",
        "jockey_profiles",
        "inspection_plan_templates",
        "inspection_plan_steps",
        "inspection_sessions",
        "inspection_session_steps",
        "evidence_items",
        "structured_observations",
        "ai_interventions",
        "reports",
    }.issubset(table_names)


def test_seed_database_populates_mock_vehicles_and_plan(monkeypatch, tmp_path):
    monkeypatch.setenv("JOCKEY_COPILOT_DB_PATH", str(tmp_path / "seed.db"))

    clear_database()
    seed_database()

    with sqlite3.connect(os.environ["JOCKEY_COPILOT_DB_PATH"]) as connection:
        vehicles_count = connection.execute("SELECT COUNT(*) FROM vehicles").fetchone()
        plan_steps_count = connection.execute(
            """
            SELECT COUNT(*)
            FROM inspection_plan_steps
            WHERE template_id = 'suv-petrol-automatic-v1'
            """
        ).fetchone()

    assert vehicles_count == (3,)
    assert plan_steps_count == (4,)


def test_clear_database_removes_seed_data(monkeypatch, tmp_path):
    monkeypatch.setenv("JOCKEY_COPILOT_DB_PATH", str(tmp_path / "seed.db"))
    seed_database()

    clear_database()

    with sqlite3.connect(os.environ["JOCKEY_COPILOT_DB_PATH"]) as connection:
        vehicles_count = connection.execute("SELECT COUNT(*) FROM vehicles").fetchone()

    assert vehicles_count == (0,)
