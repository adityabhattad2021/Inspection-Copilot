from typing import Any


LIVE_FRAME_RESPONSES: dict[str, dict[str, Any]] = {
    "front-main-bad-cropped": {
        "confidence": 0.78,
        "guidance": "Move a little to the left. I cannot see the front-left tyre.",
        "problems": ["front-left tyre missing", "front bumper slightly cropped"],
        "readyToCapture": False,
        "status": "adjust",
        "visibleParts": ["front bumper", "left headlight", "bonnet line"],
    },
    "front-main-good": {
        "confidence": 0.93,
        "guidance": "Good. Hold still, taking the front photo.",
        "problems": [],
        "readyToCapture": True,
        "status": "hold",
        "visibleParts": [
            "front bumper",
            "bonnet line",
            "headlight",
            "front-left tyre",
        ],
    },
    "rear-main-good": {
        "confidence": 0.92,
        "guidance": "Good. Hold still, taking the rear photo.",
        "problems": [],
        "readyToCapture": True,
        "status": "hold",
        "visibleParts": ["rear bumper", "boot line", "tail lamps"],
    },
    "dashboard-dark": {
        "confidence": 0.81,
        "guidance": "Dashboard is too dark. Move closer or switch on the cabin light.",
        "problems": ["low brightness", "odometer not readable"],
        "readyToCapture": False,
        "status": "adjust",
        "visibleParts": ["dashboard", "instrument cluster"],
    },
    "dashboard-good": {
        "confidence": 0.94,
        "guidance": "Good. Hold still, odometer and dashboard are visible.",
        "problems": [],
        "readyToCapture": True,
        "status": "hold",
        "visibleParts": ["dashboard", "instrument cluster", "odometer"],
    },
}


def analyze_live_frame(sample_key: str, expected_parts: list[str]) -> dict[str, Any]:
    return LIVE_FRAME_RESPONSES[sample_key]


def structure_observation(transcript: str) -> dict[str, Any]:
    normalized = transcript.casefold()
    issue = "scratch" if "scratch" in normalized else "none"
    severity = "minor" if "minor" in normalized else "normal"
    dent = not ("no dent" in normalized or "without dent" in normalized)

    return {
        "dent": dent,
        "issue": issue,
        "severity": severity,
    }
