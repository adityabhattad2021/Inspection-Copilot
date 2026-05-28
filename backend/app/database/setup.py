from datetime import UTC, datetime

from app.database.connection import connect_database, get_database_path
from app.database.schema import SCHEMA_SQL
from app.database.seed_data import DEMO_PLAN_STEPS, MOCK_VEHICLES, PLAN_TEMPLATES
from app.database.seed_queries import seed_plan_steps, seed_plan_templates, seed_vehicles


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def initialize_database() -> None:
    with connect_database() as connection:
        connection.executescript(SCHEMA_SQL)


def clear_database() -> None:
    db_path = get_database_path()
    if db_path.exists():
        db_path.unlink()
    initialize_database()


def seed_database() -> None:
    initialize_database()
    now = _utc_now()
    with connect_database() as connection:
        seed_vehicles(connection, MOCK_VEHICLES, now)
        seed_plan_templates(connection, PLAN_TEMPLATES, now)
        for template in PLAN_TEMPLATES:
            seed_plan_steps(connection, template["id"], DEMO_PLAN_STEPS)
