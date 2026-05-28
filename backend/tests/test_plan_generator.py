from app.services.plan_generator import generate_plan
from app.services.vehicle_lookup import lookup_vehicle


def test_generate_plan_contains_demo_steps_in_order():
    vehicle = lookup_vehicle("KA03MX2147")
    plan = generate_plan(vehicle)

    assert plan.name == "SUV Petrol Automatic Inspection Plan"
    assert [step.id for step in plan.steps] == [
        "front-main",
        "rear-main",
        "lhs-front-door",
        "dashboard-odometer",
        "engine-sound",
    ]


def test_photo_steps_include_expected_parts_for_ai_guidance():
    vehicle = lookup_vehicle("KA03MX2147")
    plan = generate_plan(vehicle)
    front = plan.steps[0]

    assert front.kind == "photo"
    assert "front bumper" in front.expected_parts
    assert front.auto_capture["enabled"] is True
    assert front.auto_capture["holdMs"] == 1200
