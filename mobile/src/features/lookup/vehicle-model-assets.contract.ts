import type { VehicleProfile } from "@/src/api/client";
import { getVehicleModelAsset } from "@/src/features/lookup/vehicle-model-assets";

const suvVehicle = {
  bodyType: "SUV",
  fuelType: "Petrol",
  make: "Hyundai",
  model: "Creta",
  registrationNumber: "KA03MX2147",
  registrationCity: "Bengaluru",
  registrationState: "Karnataka",
  transmission: "Automatic",
  variant: "SX",
  year: 2020,
} satisfies VehicleProfile;

const evVehicle = {
  bodyType: "SUV",
  fuelType: "Electric",
  make: "Tata",
  model: "Nexon EV",
  registrationNumber: "KA05NB7777",
  registrationCity: "Bengaluru",
  registrationState: "Karnataka",
  transmission: "Automatic",
  variant: "XZ Plus",
  year: 2021,
} satisfies VehicleProfile;

const sedanVehicle = {
  bodyType: "Sedan",
  fuelType: "Petrol",
  make: "Honda",
  model: "City",
  registrationNumber: "DL8CAF5031",
  registrationCity: "Delhi",
  registrationState: "Delhi",
  transmission: "Manual",
  variant: "VX",
  year: 2019,
} satisfies VehicleProfile;

export function vehicleModelAssetContract() {
  const suv = getVehicleModelAsset(suvVehicle);
  const ev = getVehicleModelAsset(evVehicle);
  const sedan = getVehicleModelAsset(sedanVehicle);

  return {
    evPaint: ev.paintName,
    evVariant: ev.variant,
    hasDistinctSuvAndSedanAssets: suv.modelUri !== sedan.modelUri,
    sedanPaint: sedan.paintName,
    sedanVariant: sedan.variant,
    suvPaint: suv.paintName,
    suvVariant: suv.variant,
  };
}
