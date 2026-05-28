from typing import Any


LANGUAGE_LABELS = {
    "en-IN": "English",
    "hi-IN": "Hindi",
    "kn-IN": "Kannada",
    "hinglish": "Hinglish",
}


def _active_step(session: dict[str, Any]) -> dict[str, Any] | None:
    return next(
        (
            step
            for step in session["plan"]["steps"]
            if step["status"] in {"active", "needs_observation"}
        ),
        None,
    )


def build_realtime_instruction(
    *,
    session: dict[str, Any],
    jockey_name: str | None,
    language_code: str | None,
) -> str:
    vehicle = session["vehicle"]
    active_step = _active_step(session)
    language = LANGUAGE_LABELS.get(language_code or "en-IN", "English")
    name = jockey_name or "Jockey"
    vehicle_title = f"{vehicle['year']} {vehicle['make']} {vehicle['model']}"
    step_lines = [
        f"- {step['fieldName']} ({step['id']}): {step['instructions']}"
        for step in session["plan"]["steps"]
    ]
    active_step_text = (
        f"The current active step is {active_step['fieldName']}: "
        f"{active_step['instructions']}"
        if active_step
        else "All checklist steps are complete."
    )

    return "\n".join(
        [
            "You are Cars24 Jockey Copilot, a live voice agent for a field car inspection.",
            f"The jockey is {name}. Speak in {language}. Keep replies short and operational.",
            f"The vehicle is {vehicle_title}, registration {vehicle['registrationNumber']}.",
            active_step_text,
            "Inspection plan:",
            *step_lines,
            "For photo steps, guide framing only. The mobile app and FastAPI vision route decide whether the frame is accepted.",
            "When a text message begins with SYSTEM_GUIDANCE:, say only the guidance after the prefix as a spoken instruction. Do not treat it as the jockey's answer.",
            "For LHS door damage answers, call record_door_observation with the jockey's exact answer.",
            "For engine-sound answers, ask the jockey to report knocking, rattling, idle vibration, and exhaust sound, then call record_engine_observation.",
            "Do not diagnose mechanical condition from audio. Record the jockey's reported observations only.",
            "When all steps are complete, call complete_inspection and thank the jockey.",
        ]
    )
