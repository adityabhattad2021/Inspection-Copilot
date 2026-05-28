import { lookupVehicle } from "@/src/api/client";

export type VehicleFoundRoute = {
  pathname: "/vehicle-found";
  params: {
    registrationNumber: string;
  };
};

export function normalizeRegistrationNumber(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function buildVehicleFoundRoute(
  registrationNumber: string,
): VehicleFoundRoute {
  return {
    params: {
      registrationNumber: normalizeRegistrationNumber(registrationNumber),
    },
    pathname: "/vehicle-found",
  };
}

export async function lookupVehicleAndBuildFoundRoute(
  registrationNumber: string,
): Promise<VehicleFoundRoute> {
  const vehicle = await lookupVehicle(
    normalizeRegistrationNumber(registrationNumber),
  );

  return buildVehicleFoundRoute(vehicle.registrationNumber);
}
