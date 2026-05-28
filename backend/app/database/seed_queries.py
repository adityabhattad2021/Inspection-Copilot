import json
import sqlite3
from typing import Any


def seed_vehicles(
    connection: sqlite3.Connection,
    vehicles: list[dict[str, Any]],
    now: str,
) -> None:
    connection.executemany(
        """
        INSERT INTO vehicles (
            registration_number,
            make,
            model,
            year,
            variant,
            fuel_type,
            transmission,
            body_type,
            registration_city,
            registration_state,
            created_at,
            updated_at
        )
        VALUES (
            :registration_number,
            :make,
            :model,
            :year,
            :variant,
            :fuel_type,
            :transmission,
            :body_type,
            :registration_city,
            :registration_state,
            :created_at,
            :updated_at
        )
        ON CONFLICT(registration_number) DO UPDATE SET
            make = excluded.make,
            model = excluded.model,
            year = excluded.year,
            variant = excluded.variant,
            fuel_type = excluded.fuel_type,
            transmission = excluded.transmission,
            body_type = excluded.body_type,
            registration_city = excluded.registration_city,
            registration_state = excluded.registration_state,
            updated_at = excluded.updated_at
        """,
        [
            {**vehicle, "created_at": now, "updated_at": now}
            for vehicle in vehicles
        ],
    )


def seed_plan_templates(
    connection: sqlite3.Connection,
    templates: list[dict[str, Any]],
    now: str,
) -> None:
    connection.executemany(
        """
        INSERT INTO inspection_plan_templates (
            id,
            name,
            body_type,
            fuel_type,
            transmission,
            version,
            is_active,
            created_at,
            updated_at
        )
        VALUES (
            :id,
            :name,
            :body_type,
            :fuel_type,
            :transmission,
            :version,
            :is_active,
            :created_at,
            :updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            body_type = excluded.body_type,
            fuel_type = excluded.fuel_type,
            transmission = excluded.transmission,
            version = excluded.version,
            is_active = excluded.is_active,
            updated_at = excluded.updated_at
        """,
        [
            {**template, "created_at": now, "updated_at": now}
            for template in templates
        ],
    )


def seed_plan_steps(
    connection: sqlite3.Connection,
    template_id: str,
    steps: list[dict[str, Any]],
) -> None:
    connection.executemany(
        """
        INSERT INTO inspection_plan_steps (
            template_id,
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
        )
        VALUES (
            :template_id,
            :step_id,
            :field_id,
            :field_name,
            :section,
            :kind,
            :instructions,
            :expected_parts_json,
            :auto_capture_enabled,
            :auto_capture_hold_ms,
            :sort_order
        )
        ON CONFLICT(template_id, step_id) DO UPDATE SET
            field_id = excluded.field_id,
            field_name = excluded.field_name,
            section = excluded.section,
            kind = excluded.kind,
            instructions = excluded.instructions,
            expected_parts_json = excluded.expected_parts_json,
            auto_capture_enabled = excluded.auto_capture_enabled,
            auto_capture_hold_ms = excluded.auto_capture_hold_ms,
            sort_order = excluded.sort_order
        """,
        [
            {
                **step,
                "template_id": template_id,
                "expected_parts_json": json.dumps(step["expected_parts"]),
            }
            for step in steps
        ],
    )
