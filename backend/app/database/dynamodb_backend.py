import os
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Attr, Key

from app.database.seed_data import DEMO_PLAN_STEPS, MOCK_VEHICLES, PLAN_TEMPLATES


def _utc_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _table_name() -> str:
    table_name = os.environ.get("JOCKEY_COPILOT_DDB_TABLE")
    if not table_name:
        raise RuntimeError("JOCKEY_COPILOT_DDB_TABLE is required for DynamoDB storage")
    return table_name


def _table():
    resource = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION"))
    return resource.Table(_table_name())


def _to_dynamodb(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _to_dynamodb(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_dynamodb(item) for item in value]
    return value


def _from_dynamodb(value: Any) -> Any:
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    if isinstance(value, dict):
        return {key: _from_dynamodb(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_from_dynamodb(item) for item in value]
    return value


def _put_item(item: dict[str, Any]) -> None:
    _table().put_item(Item=_to_dynamodb(item))


def _scan_by_entity(entity_type: str) -> list[dict[str, Any]]:
    response = _table().scan(FilterExpression=Attr("entityType").eq(entity_type))
    items = response.get("Items", [])
    while "LastEvaluatedKey" in response:
        response = _table().scan(
            FilterExpression=Attr("entityType").eq(entity_type),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))
    return [_from_dynamodb(item) for item in items]


def _query_partition(partition_key: str) -> list[dict[str, Any]]:
    response = _table().query(KeyConditionExpression=Key("PK").eq(partition_key))
    items = response.get("Items", [])
    while "LastEvaluatedKey" in response:
        response = _table().query(
            KeyConditionExpression=Key("PK").eq(partition_key),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))
    return [_from_dynamodb(item) for item in items]


def _vehicle_key(registration_number: str) -> dict[str, str]:
    return {"PK": f"VEHICLE#{registration_number}", "SK": "META"}


def _session_pk(session_id: str) -> str:
    return f"SESSION#{session_id}"


def _step_sk(sort_order: int) -> str:
    return f"STEP#{sort_order:06d}"


def get_database_path() -> str:
    return f"dynamodb://{_table_name()}"


def initialize_database() -> None:
    _table_name()


def clear_database() -> None:
    table = _table()
    response = table.scan(ProjectionExpression="PK, SK")
    items = response.get("Items", [])
    while "LastEvaluatedKey" in response:
        response = table.scan(
            ProjectionExpression="PK, SK",
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items.extend(response.get("Items", []))

    with table.batch_writer() as batch:
        for item in items:
            batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})


def seed_database() -> None:
    now = _utc_now()
    for vehicle in MOCK_VEHICLES:
        _put_item(
            {
                **_vehicle_key(vehicle["registration_number"]),
                "entityType": "vehicle",
                "payload": {
                    **vehicle,
                    "created_at": now,
                    "updated_at": now,
                },
            }
        )

    for template in PLAN_TEMPLATES:
        _put_item(
            {
                "PK": f"PLAN_TEMPLATE#{template['id']}",
                "SK": "META",
                "entityType": "plan_template",
                "payload": {
                    **template,
                    "created_at": now,
                    "updated_at": now,
                },
            }
        )
        for step in DEMO_PLAN_STEPS:
            _put_item(
                {
                    "PK": f"PLAN_TEMPLATE#{template['id']}",
                    "SK": _step_sk(step["sort_order"]),
                    "entityType": "plan_step",
                    "payload": step,
                }
            )


def get_vehicle(registration_number: str) -> dict[str, Any] | None:
    item = _table().get_item(Key=_vehicle_key(registration_number)).get("Item")
    if item is None:
        return None
    return _from_dynamodb(item["payload"])


def list_vehicles() -> list[dict[str, Any]]:
    vehicles = [item["payload"] for item in _scan_by_entity("vehicle")]
    return sorted(vehicles, key=lambda vehicle: vehicle.get("created_at", ""))


def _select_plan_template(vehicle: dict[str, Any]) -> dict[str, Any]:
    templates = [item["payload"] for item in _scan_by_entity("plan_template")]
    active_templates = [template for template in templates if template["is_active"] == 1]
    exact_matches = [
        template
        for template in active_templates
        if template["body_type"] == vehicle["body_type"]
        and template["fuel_type"] == vehicle["fuel_type"]
        and template["transmission"] == vehicle["transmission"]
    ]
    if exact_matches:
        return sorted(exact_matches, key=lambda template: template["version"], reverse=True)[0]

    fallbacks = [
        template
        for template in active_templates
        if template["body_type"] is None
        and template["fuel_type"] is None
        and template["transmission"] is None
    ]
    if not fallbacks:
        raise RuntimeError("No seeded inspection plan template found")
    return sorted(fallbacks, key=lambda template: template["version"], reverse=True)[0]


def _plan_step_payload(step: dict[str, Any], status: str = "pending") -> dict[str, Any]:
    auto_capture = None
    if step["auto_capture_enabled"] is not None:
        auto_capture = {
            "enabled": bool(step["auto_capture_enabled"]),
            "holdMs": step["auto_capture_hold_ms"],
        }
    return {
        "id": step["step_id"],
        "fieldId": step["field_id"],
        "fieldName": step["field_name"],
        "section": step["section"],
        "kind": step["kind"],
        "instructions": step["instructions"],
        "expectedParts": step["expected_parts"],
        "status": status,
        "autoCapture": auto_capture,
    }


def build_inspection_plan(vehicle: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    template = _select_plan_template(vehicle)
    items = [
        item
        for item in _query_partition(f"PLAN_TEMPLATE#{template['id']}")
        if item["SK"].startswith("STEP#")
    ]
    steps = [item["payload"] for item in sorted(items, key=lambda item: item["SK"])]
    return template["id"], {
        "name": template["name"],
        "steps": [_plan_step_payload(step) for step in steps],
    }


def save_session_payload(payload: dict[str, Any], plan_template_id: str) -> None:
    session_id = payload["sessionId"]
    _put_item(
        {
            "PK": _session_pk(session_id),
            "SK": "META",
            "entityType": "session",
            "status": payload["status"],
            "planTemplateId": plan_template_id,
            "planName": payload["plan"]["name"],
            "vehicle": payload["vehicle"],
            "createdAt": payload["createdAt"],
            "updatedAt": payload["updatedAt"],
        }
    )
    for index, step in enumerate(payload["plan"]["steps"], start=1):
        _put_item(
            {
                "PK": _session_pk(session_id),
                "SK": _step_sk(index),
                "entityType": "session_step",
                "stepId": step["id"],
                "sortOrder": index,
                "payload": step,
            }
        )


def load_session_payload(session_id: str) -> dict[str, Any] | None:
    items = _query_partition(_session_pk(session_id))
    meta = next((item for item in items if item["SK"] == "META"), None)
    if meta is None:
        return None
    steps = [
        item["payload"]
        for item in sorted(
            (item for item in items if item["SK"].startswith("STEP#")),
            key=lambda item: item["sortOrder"],
        )
    ]
    return {
        "sessionId": session_id,
        "status": meta["status"],
        "vehicle": meta["vehicle"],
        "plan": {
            "name": meta["planName"],
            "steps": steps,
        },
        "createdAt": meta["createdAt"],
        "updatedAt": meta["updatedAt"],
    }


def get_session_step(session_id: str, step_id: str) -> dict[str, Any] | None:
    items = _query_partition(_session_pk(session_id))
    step = next(
        (
            item
            for item in items
            if item["SK"].startswith("STEP#") and item["payload"]["id"] == step_id
        ),
        None,
    )
    if step is None:
        return None
    payload = step["payload"]
    return {
        "step_id": payload["id"],
        "field_id": payload["fieldId"],
        "field_name": payload["fieldName"],
        "section": payload["section"],
        "kind": payload["kind"],
        "instructions": payload["instructions"],
        "expected_parts": payload["expectedParts"],
        "status": payload["status"],
        "auto_capture": payload["autoCapture"],
        "sort_order": step["sortOrder"],
    }


def _update_session_meta(session_id: str, updated_at: str, status: str | None = None) -> None:
    meta = _table().get_item(Key={"PK": _session_pk(session_id), "SK": "META"}).get("Item")
    if meta is None:
        return
    meta = _from_dynamodb(meta)
    meta["updatedAt"] = updated_at
    if status is not None:
        meta["status"] = status
    _put_item(meta)


def _put_step_item(item: dict[str, Any], *, status: str) -> None:
    updated = {**item}
    updated["payload"] = {**item["payload"], "status": status}
    _put_item(updated)


def activate_first_step(session_id: str, updated_at: str) -> str | None:
    items = [
        item
        for item in _query_partition(_session_pk(session_id))
        if item["SK"].startswith("STEP#")
    ]
    active = next(
        (
            item
            for item in sorted(items, key=lambda item: item["sortOrder"])
            if item["payload"]["status"] in {"active", "needs_observation"}
        ),
        None,
    )
    if active is not None:
        _update_session_meta(session_id, updated_at, "active")
        return active["payload"]["id"]

    first_pending = next(
        (
            item
            for item in sorted(items, key=lambda item: item["sortOrder"])
            if item["payload"]["status"] == "pending"
        ),
        None,
    )
    if first_pending is None:
        return None
    _put_step_item(first_pending, status="active")
    _update_session_meta(session_id, updated_at, "active")
    return first_pending["payload"]["id"]


def set_step_status(session_id: str, step_id: str, status: str, updated_at: str) -> None:
    items = _query_partition(_session_pk(session_id))
    step = next(
        (
            item
            for item in items
            if item["SK"].startswith("STEP#") and item["payload"]["id"] == step_id
        ),
        None,
    )
    if step is not None:
        _put_step_item(step, status=status)
    _update_session_meta(session_id, updated_at)


def complete_step_and_activate_next(
    session_id: str,
    step_id: str,
    updated_at: str,
) -> str | None:
    items = [
        item
        for item in _query_partition(_session_pk(session_id))
        if item["SK"].startswith("STEP#")
    ]
    ordered = sorted(items, key=lambda item: item["sortOrder"])
    current = next((item for item in ordered if item["payload"]["id"] == step_id), None)
    if current is None:
        return None
    _put_step_item(current, status="complete")

    next_step = next(
        (
            item
            for item in ordered
            if item["sortOrder"] > current["sortOrder"]
            and item["payload"]["status"] == "pending"
        ),
        None,
    )
    if next_step is not None:
        _put_step_item(next_step, status="active")
    _update_session_meta(session_id, updated_at)
    return None if next_step is None else next_step["payload"]["id"]


def set_session_status(session_id: str, status: str, updated_at: str) -> None:
    _update_session_meta(session_id, updated_at, status)


def count_completed_steps(session_id: str) -> int:
    return sum(
        1
        for item in _query_partition(_session_pk(session_id))
        if item["SK"].startswith("STEP#") and item["payload"]["status"] == "complete"
    )


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
    _put_item(
        {
            "PK": _session_pk(session_id),
            "SK": f"AI#{created_at}#{intervention_id}",
            "entityType": "ai_intervention",
            "id": intervention_id,
            "stepId": step_id,
            "type": intervention_type,
            "message": message,
            "confidence": confidence,
            "payload": payload,
            "createdAt": created_at,
        }
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
    _put_item(
        {
            "PK": _session_pk(session_id),
            "SK": f"EVIDENCE#{created_at}#{evidence_id}",
            "entityType": "evidence",
            "id": evidence_id,
            "stepId": step_id,
            "kind": kind,
            "objectKey": object_key,
            "localUri": local_uri,
            "qualityScore": quality_score,
            "accepted": accepted,
            "metadata": metadata,
            "createdAt": created_at,
        }
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
    _put_item(
        {
            "PK": _session_pk(session_id),
            "SK": f"OBS#{created_at}#{observation_id}",
            "entityType": "structured_observation",
            "id": observation_id,
            "stepId": step_id,
            "fieldId": field_id,
            "transcript": transcript,
            "issue": issue,
            "severity": severity,
            "confidence": confidence,
            "payload": payload,
            "createdAt": created_at,
        }
    )


def save_profile_payload(payload: dict[str, Any]) -> None:
    _put_item(
        {
            "PK": f"PROFILE#{payload['profileId']}",
            "SK": "META",
            "entityType": "profile",
            "payload": payload,
        }
    )


def load_profile_payload(profile_id: str) -> dict[str, Any] | None:
    item = _table().get_item(Key={"PK": f"PROFILE#{profile_id}", "SK": "META"}).get("Item")
    if item is None:
        return None
    return _from_dynamodb(item["payload"])


def list_profile_payloads() -> list[dict[str, Any]]:
    profiles = [item["payload"] for item in _scan_by_entity("profile")]
    return sorted(profiles, key=lambda profile: profile.get("createdAt", ""))
