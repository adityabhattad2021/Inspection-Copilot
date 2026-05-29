import json
from typing import Any

from app.database.connection import connect_database
from app.database.setup import initialize_database


def get_session_step(session_id: str, step_id: str) -> dict[str, Any] | None:
    initialize_database()
    with connect_database() as connection:
        row = connection.execute(
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
                AND step_id = ?
            """,
            (session_id, step_id),
        ).fetchone()
    return None if row is None else dict(row)


def activate_first_step(session_id: str, updated_at: str) -> str | None:
    initialize_database()
    with connect_database() as connection:
        active = connection.execute(
            """
            SELECT step_id
            FROM inspection_session_steps
            WHERE session_id = ?
                AND status IN ('active', 'needs_observation')
            ORDER BY sort_order
            LIMIT 1
            """,
            (session_id,),
        ).fetchone()
        if active is not None:
            connection.execute(
                """
                UPDATE inspection_sessions
                SET status = 'active', updated_at = ?
                WHERE session_id = ?
                """,
                (updated_at, session_id),
            )
            return active["step_id"]

        first_pending = connection.execute(
            """
            SELECT step_id
            FROM inspection_session_steps
            WHERE session_id = ?
                AND status = 'pending'
            ORDER BY sort_order
            LIMIT 1
            """,
            (session_id,),
        ).fetchone()
        if first_pending is None:
            return None

        connection.execute(
            """
            UPDATE inspection_session_steps
            SET status = 'active'
            WHERE session_id = ?
                AND step_id = ?
            """,
            (session_id, first_pending["step_id"]),
        )
        connection.execute(
            """
            UPDATE inspection_sessions
            SET status = 'active', updated_at = ?
            WHERE session_id = ?
            """,
            (updated_at, session_id),
        )
        return first_pending["step_id"]


def set_step_status(session_id: str, step_id: str, status: str, updated_at: str) -> None:
    initialize_database()
    with connect_database() as connection:
        connection.execute(
            """
            UPDATE inspection_session_steps
            SET status = ?
            WHERE session_id = ?
                AND step_id = ?
            """,
            (status, session_id, step_id),
        )
        connection.execute(
            """
            UPDATE inspection_sessions
            SET updated_at = ?
            WHERE session_id = ?
            """,
            (updated_at, session_id),
        )


def complete_step_and_activate_next(
    session_id: str,
    step_id: str,
    updated_at: str,
) -> str | None:
    initialize_database()
    with connect_database() as connection:
        current = connection.execute(
            """
            SELECT sort_order, status
            FROM inspection_session_steps
            WHERE session_id = ?
                AND step_id = ?
            """,
            (session_id, step_id),
        ).fetchone()
        if current is None:
            return None

        if current["status"] == "complete":
            active_step = connection.execute(
                """
                SELECT step_id
                FROM inspection_session_steps
                WHERE session_id = ?
                    AND sort_order > ?
                    AND status = 'active'
                ORDER BY sort_order
                LIMIT 1
                """,
                (session_id, current["sort_order"]),
            ).fetchone()
            return None if active_step is None else active_step["step_id"]

        connection.execute(
            """
            UPDATE inspection_session_steps
            SET status = 'complete'
            WHERE session_id = ?
                AND step_id = ?
            """,
            (session_id, step_id),
        )
        next_step = connection.execute(
            """
            SELECT step_id
            FROM inspection_session_steps
            WHERE session_id = ?
                AND sort_order > ?
                AND status = 'pending'
            ORDER BY sort_order
            LIMIT 1
            """,
            (session_id, current["sort_order"]),
        ).fetchone()
        if next_step is not None:
            connection.execute(
                """
                UPDATE inspection_session_steps
                SET status = 'active'
                WHERE session_id = ?
                    AND step_id = ?
                """,
                (session_id, next_step["step_id"]),
            )
        connection.execute(
            """
            UPDATE inspection_sessions
            SET updated_at = ?
            WHERE session_id = ?
            """,
            (updated_at, session_id),
        )
    return None if next_step is None else next_step["step_id"]


def set_session_status(session_id: str, status: str, updated_at: str) -> None:
    initialize_database()
    with connect_database() as connection:
        connection.execute(
            """
            UPDATE inspection_sessions
            SET status = ?, updated_at = ?
            WHERE session_id = ?
            """,
            (status, updated_at, session_id),
        )


def count_completed_steps(session_id: str) -> int:
    initialize_database()
    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT COUNT(*)
            FROM inspection_session_steps
            WHERE session_id = ?
                AND status = 'complete'
            """,
            (session_id,),
        ).fetchone()
    return int(row[0])


def save_ai_intervention(
    *,
    intervention_id: str,
    session_id: str,
    step_id: str,
    intervention_type: str,
    message: str,
    confidence: float,
    payload: dict[str, Any],
    created_at: str,
) -> None:
    initialize_database()
    with connect_database() as connection:
        connection.execute(
            """
            INSERT INTO ai_interventions (
                id,
                session_id,
                step_id,
                type,
                message,
                confidence,
                payload_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                intervention_id,
                session_id,
                step_id,
                intervention_type,
                message,
                confidence,
                json.dumps(payload),
                created_at,
            ),
        )


def save_evidence_item(
    *,
    evidence_id: str,
    session_id: str,
    step_id: str,
    kind: str,
    object_key: str | None,
    local_uri: str | None,
    quality_score: float,
    accepted: bool,
    metadata: dict[str, Any],
    created_at: str,
) -> None:
    initialize_database()
    with connect_database() as connection:
        connection.execute(
            """
            INSERT INTO evidence_items (
                id,
                session_id,
                step_id,
                kind,
                object_key,
                local_uri,
                quality_score,
                accepted,
                metadata_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                evidence_id,
                session_id,
                step_id,
                kind,
                object_key,
                local_uri,
                quality_score,
                int(accepted),
                json.dumps(metadata),
                created_at,
            ),
        )


def save_structured_observation(
    *,
    observation_id: str,
    session_id: str,
    step_id: str,
    field_id: int,
    transcript: str,
    issue: str | None,
    severity: str | None,
    confidence: float,
    payload: dict[str, Any],
    created_at: str,
) -> None:
    initialize_database()
    with connect_database() as connection:
        connection.execute(
            """
            INSERT INTO structured_observations (
                id,
                session_id,
                step_id,
                field_id,
                transcript,
                issue,
                severity,
                confidence,
                payload_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                observation_id,
                session_id,
                step_id,
                field_id,
                transcript,
                issue,
                severity,
                confidence,
                json.dumps(payload),
                created_at,
            ),
        )
