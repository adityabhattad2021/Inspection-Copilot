import json
import sqlite3
from typing import Any

from app.database.connection import connect_database
from app.database.setup import initialize_database


def _select_plan_template(vehicle: dict[str, Any]) -> sqlite3.Row:
    with connect_database() as connection:
        exact = connection.execute(
            """
            SELECT id, name
            FROM inspection_plan_templates
            WHERE is_active = 1
                AND body_type = ?
                AND fuel_type = ?
                AND transmission = ?
            ORDER BY version DESC
            LIMIT 1
            """,
            (
                vehicle["body_type"],
                vehicle["fuel_type"],
                vehicle["transmission"],
            ),
        ).fetchone()
        if exact is not None:
            return exact

        fallback = connection.execute(
            """
            SELECT id, name
            FROM inspection_plan_templates
            WHERE is_active = 1
                AND body_type IS NULL
                AND fuel_type IS NULL
                AND transmission IS NULL
            ORDER BY version DESC
            LIMIT 1
            """
        ).fetchone()
    if fallback is None:
        raise RuntimeError("No seeded inspection plan template found")
    return fallback


def _list_plan_steps(template_id: str) -> list[dict[str, Any]]:
    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT
                step_id,
                field_id,
                field_name,
                section,
                kind,
                instructions,
                expected_parts_json,
                auto_capture_enabled,
                auto_capture_hold_ms,
                sort_order
            FROM inspection_plan_steps
            WHERE template_id = ?
            ORDER BY sort_order
            """,
            (template_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def step_payload(row: dict[str, Any]) -> dict[str, Any]:
    auto_capture = None
    if row["auto_capture_enabled"] is not None:
        auto_capture = {
            "enabled": bool(row["auto_capture_enabled"]),
            "holdMs": row["auto_capture_hold_ms"],
        }

    return {
        "id": row["step_id"],
        "fieldId": row["field_id"],
        "fieldName": row["field_name"],
        "section": row["section"],
        "kind": row["kind"],
        "instructions": row["instructions"],
        "expectedParts": json.loads(row["expected_parts_json"]),
        "status": row.get("status", "pending"),
        "autoCapture": auto_capture,
    }


def build_inspection_plan(vehicle: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    initialize_database()
    template = _select_plan_template(vehicle)
    steps = _list_plan_steps(template["id"])
    return template["id"], {
        "name": template["name"],
        "steps": [step_payload(step) for step in steps],
    }
