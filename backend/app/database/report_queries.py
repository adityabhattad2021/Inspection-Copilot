import json
from typing import Any

from app.database.connection import connect_database
from app.database.setup import initialize_database


def _json_payload(raw_value: str | None) -> dict[str, Any]:
    if not raw_value:
        return {}
    return json.loads(raw_value)


def list_evidence_items(session_id: str) -> list[dict[str, Any]]:
    initialize_database()
    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                step_id,
                kind,
                object_key,
                local_uri,
                quality_score,
                accepted,
                metadata_json,
                created_at
            FROM evidence_items
            WHERE session_id = ?
            ORDER BY created_at, id
            """,
            (session_id,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "stepId": row["step_id"],
            "kind": row["kind"],
            "objectKey": row["object_key"],
            "localUri": row["local_uri"],
            "qualityScore": row["quality_score"] or 0.0,
            "accepted": bool(row["accepted"]),
            "metadata": _json_payload(row["metadata_json"]),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


def list_structured_observations(session_id: str) -> list[dict[str, Any]]:
    initialize_database()
    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                step_id,
                field_id,
                transcript,
                issue,
                severity,
                confidence,
                payload_json,
                created_at
            FROM structured_observations
            WHERE session_id = ?
            ORDER BY created_at, id
            """,
            (session_id,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "stepId": row["step_id"],
            "fieldId": row["field_id"],
            "transcript": row["transcript"],
            "issue": row["issue"],
            "severity": row["severity"],
            "confidence": row["confidence"] or 0.0,
            "structuredFields": _json_payload(row["payload_json"]),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


def list_ai_interventions(session_id: str) -> list[dict[str, Any]]:
    initialize_database()
    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                step_id,
                type,
                message,
                confidence,
                payload_json,
                created_at
            FROM ai_interventions
            WHERE session_id = ?
            ORDER BY created_at, id
            """,
            (session_id,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "stepId": row["step_id"],
            "type": row["type"],
            "message": row["message"],
            "confidence": row["confidence"] or 0.0,
            "payload": _json_payload(row["payload_json"]),
            "createdAt": row["created_at"],
        }
        for row in rows
    ]


def save_report_payload(payload: dict[str, Any]) -> None:
    initialize_database()
    with connect_database() as connection:
        connection.execute(
            """
            INSERT INTO reports (
                report_id,
                session_id,
                status,
                completion_score,
                media_quality_score,
                pricing_risk,
                report_json,
                report_html_path,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                report_id = excluded.report_id,
                status = excluded.status,
                completion_score = excluded.completion_score,
                media_quality_score = excluded.media_quality_score,
                pricing_risk = excluded.pricing_risk,
                report_json = excluded.report_json,
                report_html_path = excluded.report_html_path,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at
            """,
            (
                payload["reportId"],
                payload["sessionId"],
                payload["status"],
                payload["completionScore"],
                payload["mediaQualityScore"],
                payload["pricingRisk"],
                json.dumps(payload["reportJson"]),
                payload["reportHtmlPath"],
                payload["createdAt"],
                payload["updatedAt"],
            ),
        )


def load_report_payload(session_id: str) -> dict[str, Any] | None:
    initialize_database()
    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                report_id,
                session_id,
                status,
                completion_score,
                media_quality_score,
                pricing_risk,
                report_json,
                report_html_path,
                created_at,
                updated_at
            FROM reports
            WHERE session_id = ?
            """,
            (session_id,),
        ).fetchone()

    if row is None:
        return None

    return {
        "reportId": row["report_id"],
        "sessionId": row["session_id"],
        "status": row["status"],
        "completionScore": row["completion_score"] or 0.0,
        "mediaQualityScore": row["media_quality_score"] or 0.0,
        "pricingRisk": row["pricing_risk"],
        "reportJson": json.loads(row["report_json"]),
        "reportHtmlPath": row["report_html_path"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def list_report_payloads() -> list[dict[str, Any]]:
    initialize_database()
    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT
                report_id,
                session_id,
                status,
                completion_score,
                media_quality_score,
                pricing_risk,
                report_json,
                report_html_path,
                created_at,
                updated_at
            FROM reports
            ORDER BY created_at DESC, report_id DESC
            """
        ).fetchall()

    return [
        {
            "reportId": row["report_id"],
            "sessionId": row["session_id"],
            "status": row["status"],
            "completionScore": row["completion_score"] or 0.0,
            "mediaQualityScore": row["media_quality_score"] or 0.0,
            "pricingRisk": row["pricing_risk"],
            "reportJson": json.loads(row["report_json"]),
            "reportHtmlPath": row["report_html_path"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]
