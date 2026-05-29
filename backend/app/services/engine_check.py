from typing import Any


ENGINE_ANSWER_LABELS = {
    "exhaustSound": "Exhaust sound",
    "idleVibration": "Idle vibration",
    "knocking": "Knocking",
    "rattling": "Rattling",
}


def _answer_value(answers: dict[str, Any], key: str) -> str:
    return str(answers.get(key) or "").strip().casefold()


def structure_engine_answers(transcript: str) -> dict[str, Any]:
    normalized = transcript.casefold()

    return {
        "abnormalVibration": (
            "mild at idle" if "mild vibration" in normalized else "not observed"
        ),
        "exhaustSound": (
            "normal"
            if "exhaust" in normalized and "normal" in normalized
            else "needs review"
        ),
        "knocking": not ("no knocking" in normalized or "no knock" in normalized),
        "rattling": "rattl" in normalized and "no rattl" not in normalized,
    }


def structure_engine_answer_options(answers: dict[str, Any]) -> dict[str, Any]:
    idle_vibration = _answer_value(answers, "idleVibration")
    exhaust_sound = _answer_value(answers, "exhaustSound")

    return {
        "abnormalVibration": (
            "mild at idle"
            if idle_vibration == "mild"
            else "heavy at idle"
            if idle_vibration == "heavy"
            else "not observed"
        ),
        "exhaustSound": "normal" if exhaust_sound == "normal" else "needs review",
        "knocking": _answer_value(answers, "knocking") == "yes",
        "rattling": _answer_value(answers, "rattling") == "yes",
    }


def engine_answers_to_transcript(answers: dict[str, Any]) -> str:
    parts = []
    for key in ["knocking", "rattling", "idleVibration", "exhaustSound"]:
        value = str(answers.get(key) or "not answered").strip()
        label = ENGINE_ANSWER_LABELS[key]
        parts.append(f"{label}: {value}.")
    return " ".join(parts)


def engine_issue_summary(fields: dict[str, Any]) -> tuple[str | None, str | None]:
    if fields["knocking"] or fields["rattling"]:
        return "abnormal engine sound", "major"
    if fields["abnormalVibration"] != "not observed":
        return "mild vibration", "minor"
    return None, "normal"
