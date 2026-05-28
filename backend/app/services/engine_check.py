from typing import Any


def structure_engine_answers(transcript: str) -> dict[str, Any]:
    normalized = transcript.casefold()

    return {
        "abnormalVibration": (
            "mild at idle" if "mild vibration" in normalized else "not observed"
        ),
        "exhaustSound": "normal" if "exhaust" in normalized and "normal" in normalized else "needs review",
        "knocking": not ("no knocking" in normalized or "no knock" in normalized),
        "rattling": "rattl" in normalized and "no rattl" not in normalized,
    }


def engine_issue_summary(fields: dict[str, Any]) -> tuple[str | None, str | None]:
    if fields["knocking"] or fields["rattling"]:
        return "abnormal engine sound", "major"
    if fields["abnormalVibration"] != "not observed":
        return "mild vibration", "minor"
    return None, "normal"
