import type { VehicleProfile } from "@/src/api/client";
import { KENNEY_SEDAN_SILVER_MODEL_DATA_URI } from "@/src/features/lookup/kenney-sedan-silver-model-data";
import { KENNEY_SUV_RED_MODEL_DATA_URI } from "@/src/features/lookup/kenney-suv-red-model-data";
import { KENNEY_SUV_TEAL_MODEL_DATA_URI } from "@/src/features/lookup/kenney-suv-teal-model-data";
import { KENNEY_SUV_WHITE_MODEL_DATA_URI } from "@/src/features/lookup/kenney-suv-white-model-data";

export type VehicleModelVariant =
  | "sedan-silver"
  | "suv-red"
  | "suv-teal"
  | "suv-white";

export type VehicleModelAsset = {
  modelUri: string;
  paintName: string;
  variant: VehicleModelVariant;
};

const MODEL_ASSETS = {
  "sedan-silver": {
    modelUri: KENNEY_SEDAN_SILVER_MODEL_DATA_URI,
    paintName: "Silver",
    variant: "sedan-silver",
  },
  "suv-red": {
    modelUri: KENNEY_SUV_RED_MODEL_DATA_URI,
    paintName: "Red",
    variant: "suv-red",
  },
  "suv-teal": {
    modelUri: KENNEY_SUV_TEAL_MODEL_DATA_URI,
    paintName: "EV teal",
    variant: "suv-teal",
  },
  "suv-white": {
    modelUri: KENNEY_SUV_WHITE_MODEL_DATA_URI,
    paintName: "White",
    variant: "suv-white",
  },
} satisfies Record<VehicleModelVariant, VehicleModelAsset>;

const REGISTRATION_VARIANTS: Record<string, VehicleModelVariant> = {
  DL8CAF5031: "sedan-silver",
  HR98E5819: "suv-red",
  KA03MX2147: "suv-white",
  KA05NB7777: "suv-teal",
};

export const DEFAULT_VEHICLE_MODEL_ASSET = MODEL_ASSETS["suv-white"];

export function getVehicleModelAsset(
  vehicle: Pick<
    VehicleProfile,
    "bodyType" | "fuelType" | "model" | "registrationNumber"
  >,
): VehicleModelAsset {
  const exactVariant = REGISTRATION_VARIANTS[vehicle.registrationNumber];
  if (exactVariant) {
    return MODEL_ASSETS[exactVariant];
  }

  const bodyType = vehicle.bodyType.toLowerCase();
  const fuelType = vehicle.fuelType.toLowerCase();
  const model = vehicle.model.toLowerCase();

  if (bodyType.includes("sedan")) {
    return MODEL_ASSETS["sedan-silver"];
  }

  if (fuelType.includes("electric") || model.includes("ev")) {
    return MODEL_ASSETS["suv-teal"];
  }

  return DEFAULT_VEHICLE_MODEL_ASSET;
}
