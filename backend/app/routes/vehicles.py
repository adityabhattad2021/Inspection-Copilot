import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


class VehicleLookupRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    registration_number: str = Field(alias="registrationNumber", min_length=1)


class VehicleProfile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    registration_number: str = Field(alias="registrationNumber")
    make: str
    model: str
    year: int
    variant: str
    fuel_type: str = Field(alias="fuelType")
    transmission: str
    body_type: str = Field(alias="bodyType")
    registration_city: str = Field(alias="registrationCity")
    registration_state: str = Field(alias="registrationState")


DEMO_VEHICLES: dict[str, VehicleProfile] = {
    "KA03MX2147": VehicleProfile(
        registration_number="KA03MX2147",
        make="Hyundai",
        model="Creta",
        year=2020,
        variant="SX",
        fuel_type="Petrol",
        transmission="Automatic",
        body_type="SUV",
        registration_city="Bengaluru",
        registration_state="Karnataka",
    )
}


def normalize_registration_number(registration_number: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", registration_number).upper()


def lookup_demo_vehicle(registration_number: str) -> VehicleProfile:
    normalized = normalize_registration_number(registration_number)
    vehicle = DEMO_VEHICLES.get(normalized)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Unknown demo registration")
    return vehicle


@router.post("/lookup", response_model=VehicleProfile)
def lookup_vehicle(request: VehicleLookupRequest) -> VehicleProfile:
    return lookup_demo_vehicle(request.registration_number)
