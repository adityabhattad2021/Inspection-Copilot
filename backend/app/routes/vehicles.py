import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.database import get_vehicle, list_vehicles

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


class VehicleListResponse(BaseModel):
    vehicles: list[VehicleProfile]


def normalize_registration_number(registration_number: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", registration_number).upper()


def lookup_demo_vehicle(registration_number: str) -> VehicleProfile:
    normalized = normalize_registration_number(registration_number)
    vehicle = get_vehicle(normalized)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Unknown demo registration")
    return VehicleProfile.model_validate(vehicle)


@router.post("/lookup", response_model=VehicleProfile)
def lookup_vehicle(request: VehicleLookupRequest) -> VehicleProfile:
    return lookup_demo_vehicle(request.registration_number)


@router.get("", response_model=VehicleListResponse)
def get_vehicles() -> VehicleListResponse:
    return VehicleListResponse(
        vehicles=[
            VehicleProfile.model_validate(vehicle)
            for vehicle in list_vehicles()
        ]
    )
