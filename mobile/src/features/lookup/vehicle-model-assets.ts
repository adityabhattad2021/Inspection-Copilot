import type { VehicleProfile } from "@/src/api/client";
import { KENNEY_SUV_WHITE_MODEL_DATA_URI } from "@/src/features/lookup/kenney-suv-white-model-data";

export type VehicleModelVariant = "suv-white";

export type VehicleModelAsset = {
  modelUri: string;
  paintName: string;
  variant: VehicleModelVariant;
};

export const DEFAULT_VEHICLE_MODEL_ASSET = {
  modelUri: KENNEY_SUV_WHITE_MODEL_DATA_URI,
  paintName: "White",
  variant: "suv-white",
} satisfies VehicleModelAsset;

export function getVehicleModelAsset(
  _vehicle: Pick<
    VehicleProfile,
    "bodyType" | "fuelType" | "model" | "registrationNumber"
  >,
): VehicleModelAsset {
  return DEFAULT_VEHICLE_MODEL_ASSET;
}
