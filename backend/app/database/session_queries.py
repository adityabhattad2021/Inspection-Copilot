import json
from typing import Any

from app.database.connection import connect_database
from app.database.plan_queries import step_payload
from app.database.setup import initialize_database


def save_session_payload(payload: dict[str, Any], plan_template_id: str) -> None:
    initialize_database()
    vehicle = payload["vehicle"]
    plan = payload["plan"]
    with connect_database() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO inspection_sessions (
                session_id,
                status,
                registration_number,
                plan_template_id,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload["sessionId"],
                payload["status"],
                vehicle["registrationNumber"],
                plan_template_id,
                payload["createdAt"],
                payload["updatedAt"],
            ),
        )
        connection.execute(
            "DELETE FROM inspection_session_steps WHERE session_id = ?",
            (payload["sessionId"],),
        )
        connection.executemany(
            """
            INSERT INTO inspection_session_steps (
                session_id,
                step_id,
                field_id,
                field_name,
                section,
                kind,
                instructions,
                expected_parts_json,
                status,
                auto_capture_enabled,
                auto_capture_hold_ms,
                sort_order
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    payload["sessionId"],
                    step["id"],
                    step["fieldId"],
                    step["fieldName"],
                    step["section"],
                    step["kind"],
                    step["instructions"],
                    json.dumps(step["expectedParts"]),
                    step["status"],
                    (
                        None
                        if step["autoCapture"] is None
                        else int(step["autoCapture"]["enabled"])
                    ),
                    None if step["autoCapture"] is None else step["autoCapture"]["holdMs"],
                    index,
                )
                for index, step in enumerate(plan["steps"], start=1)
            ],
        )


def load_session_payload(session_id: str) -> dict[str, Any] | None:
    initialize_database()
    with connect_database() as connection:
        session = connection.execute(
            """
            SELECT
                inspection_sessions.session_id,
                inspection_sessions.status,
                inspection_sessions.created_at,
                inspection_sessions.updated_at,
                inspection_plan_templates.name AS plan_name,
                vehicles.registration_number,
                vehicles.make,
                vehicles.model,
                vehicles.year,
                vehicles.variant,
                vehicles.fuel_type,
                vehicles.transmission,
                vehicles.body_type,
                vehicles.registration_city,
                vehicles.registration_state
            FROM inspection_sessions
            JOIN vehicles
                ON vehicles.registration_number = inspection_sessions.registration_number
            JOIN inspection_plan_templates
                ON inspection_plan_templates.id = inspection_sessions.plan_template_id
            WHERE inspection_sessions.session_id = ?
            """,
            (session_id,),
        ).fetchone()
        if session is None:
            return None

        step_rows = connection.execute(
            """
            SELECT
                step_id,
                field_id,
                field_name,
                section,
                kind,
                instructions,
                expected_parts_json,
                status,
                auto_capture_enabled,
                auto_capture_hold_ms,
                sort_order
            FROM inspection_session_steps
            WHERE session_id = ?
            ORDER BY sort_order
            """,
            (session_id,),
        ).fetchall()

    return {
        "sessionId": session["session_id"],
        "status": session["status"],
        "vehicle": {
            "registrationNumber": session["registration_number"],
            "make": session["make"],
            "model": session["model"],
            "year": session["year"],
            "variant": session["variant"],
            "fuelType": session["fuel_type"],
            "transmission": session["transmission"],
            "bodyType": session["body_type"],
            "registrationCity": session["registration_city"],
            "registrationState": session["registration_state"],
        },
        "plan": {
            "name": session["plan_name"],
            "steps": [step_payload(dict(row)) for row in step_rows],
        },
        "createdAt": session["created_at"],
        "updatedAt": session["updated_at"],
    }
