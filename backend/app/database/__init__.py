import os

if os.environ.get("JOCKEY_COPILOT_STORAGE_BACKEND") == "dynamodb":
    from app.database.dynamodb_backend import (
        activate_first_step,
        build_inspection_plan,
        clear_database,
        complete_step_and_activate_next,
        count_completed_steps,
        get_database_path,
        get_session_step,
        get_vehicle,
        initialize_database,
        list_ai_interventions,
        list_evidence_items,
        list_profile_payloads,
        list_report_payloads,
        list_structured_observations,
        list_vehicles,
        load_profile_payload,
        load_report_payload,
        load_session_payload,
        save_report_payload,
        save_ai_intervention,
        save_evidence_item,
        save_profile_payload,
        save_session_payload,
        save_structured_observation,
        seed_database,
        set_session_status,
        set_step_status,
    )

    connect_database = None
else:
    from app.database.connection import connect_database, get_database_path
    from app.database.inspection_queries import (
        activate_first_step,
        complete_step_and_activate_next,
        count_completed_steps,
        get_session_step,
        save_ai_intervention,
        save_evidence_item,
        save_structured_observation,
        set_session_status,
        set_step_status,
    )
    from app.database.plan_queries import build_inspection_plan
    from app.database.profile_queries import (
        list_profile_payloads,
        load_profile_payload,
        save_profile_payload,
    )
    from app.database.queries import get_vehicle, list_vehicles
    from app.database.report_queries import (
        list_ai_interventions,
        list_evidence_items,
        list_structured_observations,
        list_report_payloads,
        load_report_payload,
        save_report_payload,
    )
    from app.database.session_queries import load_session_payload, save_session_payload
    from app.database.setup import clear_database, initialize_database, seed_database

__all__ = [
    "build_inspection_plan",
    "clear_database",
    "activate_first_step",
    "complete_step_and_activate_next",
    "connect_database",
    "count_completed_steps",
    "get_database_path",
    "get_session_step",
    "get_vehicle",
    "initialize_database",
    "list_ai_interventions",
    "list_evidence_items",
    "list_profile_payloads",
    "list_report_payloads",
    "list_structured_observations",
    "list_vehicles",
    "load_profile_payload",
    "load_report_payload",
    "load_session_payload",
    "save_ai_intervention",
    "save_evidence_item",
    "save_profile_payload",
    "save_report_payload",
    "save_session_payload",
    "save_structured_observation",
    "seed_database",
    "set_session_status",
    "set_step_status",
]
