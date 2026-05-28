from app.services.vehicle_lookup import lookup_vehicle


def test_lookup_vehicle_returns_demo_creta():
    vehicle = lookup_vehicle("KA03MX2147")

    assert vehicle.registration_number == "KA03MX2147"
    assert vehicle.make == "Hyundai"
    assert vehicle.model == "Creta"
    assert vehicle.year == 2020
    assert vehicle.transmission == "Automatic"


def test_lookup_vehicle_normalizes_spacing_and_case():
    vehicle = lookup_vehicle(" ka 03 mx 2147 ")

    assert vehicle.registration_number == "KA03MX2147"


def test_lookup_vehicle_rejects_unknown_number():
    try:
        lookup_vehicle("KA00AA0000")
    except KeyError as exc:
        assert "Unknown demo registration" in str(exc)
    else:
        raise AssertionError("expected KeyError")
