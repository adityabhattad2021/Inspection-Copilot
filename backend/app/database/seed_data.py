from typing import Any


PHOTO_HOLD_MS = 1200


MOCK_VEHICLES: list[dict[str, Any]] = [
    {
        "registration_number": "KA03MX2147",
        "make": "Hyundai",
        "model": "Creta",
        "year": 2020,
        "variant": "SX",
        "fuel_type": "Petrol",
        "transmission": "Automatic",
        "body_type": "SUV",
        "registration_city": "Bengaluru",
        "registration_state": "Karnataka",
    },
    {
        "registration_number": "KA05NB7777",
        "make": "Tata",
        "model": "Nexon EV",
        "year": 2021,
        "variant": "XZ Plus",
        "fuel_type": "Electric",
        "transmission": "Automatic",
        "body_type": "SUV",
        "registration_city": "Bengaluru",
        "registration_state": "Karnataka",
    },
    {
        "registration_number": "DL8CAF5031",
        "make": "Honda",
        "model": "City",
        "year": 2019,
        "variant": "VX",
        "fuel_type": "Petrol",
        "transmission": "Manual",
        "body_type": "Sedan",
        "registration_city": "Delhi",
        "registration_state": "Delhi",
    },
]


PLAN_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": "suv-petrol-automatic-v1",
        "name": "SUV Petrol Automatic Inspection Plan",
        "body_type": "SUV",
        "fuel_type": "Petrol",
        "transmission": "Automatic",
        "version": 1,
        "is_active": 1,
    },
    {
        "id": "generic-used-car-v1",
        "name": "Generic Used Car Inspection Plan",
        "body_type": None,
        "fuel_type": None,
        "transmission": None,
        "version": 1,
        "is_active": 1,
    },
]


DEMO_PLAN_STEPS: list[dict[str, Any]] = [
    {
        "step_id": "front-main",
        "field_id": 21,
        "field_name": "Front Main",
        "section": "Exterior & Tyres",
        "kind": "photo",
        "instructions": (
            "Show the full front bumper, bonnet line, headlight, "
            "and front-left tyre."
        ),
        "expected_parts": [
            "front bumper",
            "bonnet line",
            "headlight",
            "front-left tyre",
        ],
        "auto_capture_enabled": 1,
        "auto_capture_hold_ms": PHOTO_HOLD_MS,
        "sort_order": 1,
    },
    {
        "step_id": "rear-main",
        "field_id": 56,
        "field_name": "Rear Main",
        "section": "Exterior & Tyres",
        "kind": "photo",
        "instructions": "Show the full rear bumper, boot line, and tail lamps.",
        "expected_parts": ["rear bumper", "boot line", "tail lamps"],
        "auto_capture_enabled": 1,
        "auto_capture_hold_ms": PHOTO_HOLD_MS,
        "sort_order": 2,
    },
    {
        "step_id": "lhs-front-door",
        "field_id": 45,
        "field_name": "LHS front door",
        "section": "Exterior & Tyres",
        "kind": "photo",
        "instructions": "Show the left front door and handle area clearly.",
        "expected_parts": ["left front door", "door handle"],
        "auto_capture_enabled": 1,
        "auto_capture_hold_ms": PHOTO_HOLD_MS,
        "sort_order": 3,
    },
    {
        "step_id": "dashboard-odometer",
        "field_id": 93,
        "field_name": "Dashboard and odometer reading",
        "section": "Interior & Electricals",
        "kind": "photo",
        "instructions": "Show the dashboard, instrument cluster, and odometer.",
        "expected_parts": ["dashboard", "instrument cluster", "odometer"],
        "auto_capture_enabled": 1,
        "auto_capture_hold_ms": PHOTO_HOLD_MS,
        "sort_order": 4,
    },
    {
        "step_id": "engine-sound",
        "field_id": 104,
        "field_name": "Engine sound condition",
        "section": "Engine",
        "kind": "engine-guided",
        "instructions": (
            "Start the engine, listen at idle, rev gently, and record "
            "knocking, rattling, vibration, or exhaust issues."
        ),
        "expected_parts": [],
        "auto_capture_enabled": None,
        "auto_capture_hold_ms": None,
        "sort_order": 5,
    },
]
