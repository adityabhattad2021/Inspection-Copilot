from typing import Any

from app.database.connection import connect_database
from app.database.setup import initialize_database


def get_vehicle(registration_number: str) -> dict[str, Any] | None:
    initialize_database()
    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                registration_number,
                make,
                model,
                year,
                variant,
                fuel_type,
                transmission,
                body_type,
                registration_city,
                registration_state
            FROM vehicles
            WHERE registration_number = ?
            """,
            (registration_number,),
        ).fetchone()
    if row is None:
        return None
    return dict(row)


def list_vehicles() -> list[dict[str, Any]]:
    initialize_database()
    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT
                registration_number,
                make,
                model,
                year,
                variant,
                fuel_type,
                transmission,
                body_type,
                registration_city,
                registration_state
            FROM vehicles
            ORDER BY created_at, rowid
            """
        ).fetchall()
    return [dict(row) for row in rows]
