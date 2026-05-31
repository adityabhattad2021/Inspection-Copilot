from typing import Any

from app.database.connection import connect_database
from app.database.setup import initialize_database


def save_profile_payload(payload: dict[str, Any]) -> None:
    initialize_database()
    with connect_database() as connection:
        connection.execute(
            """
            INSERT OR REPLACE INTO inspector_profiles (
                profile_id,
                name,
                language_code,
                language_label,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload["profileId"],
                payload["name"],
                payload["languageCode"],
                payload["languageLabel"],
                payload["createdAt"],
                payload["updatedAt"],
            ),
        )


def load_profile_payload(profile_id: str) -> dict[str, Any] | None:
    initialize_database()
    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                profile_id,
                name,
                language_code,
                language_label,
                created_at,
                updated_at
            FROM inspector_profiles
            WHERE profile_id = ?
            """,
            (profile_id,),
        ).fetchone()

    if row is None:
        return None

    return {
        "profileId": row["profile_id"],
        "name": row["name"],
        "languageCode": row["language_code"],
        "languageLabel": row["language_label"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def list_profile_payloads() -> list[dict[str, Any]]:
    initialize_database()
    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT
                profile_id,
                name,
                language_code,
                language_label,
                created_at,
                updated_at
            FROM inspector_profiles
            ORDER BY created_at, rowid
            """
        ).fetchall()

    return [
        {
            "profileId": row["profile_id"],
            "name": row["name"],
            "languageCode": row["language_code"],
            "languageLabel": row["language_label"],
            "createdAt": row["created_at"],
            "updatedAt": row["updated_at"],
        }
        for row in rows
    ]
