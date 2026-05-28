import {
  buildVehicleFoundRoute,
  lookupVehicleAndBuildFoundRoute,
  type VehicleFoundRoute,
} from "@/src/features/lookup/vehicle-found-navigation";

export async function vehicleFoundFlowContract(): Promise<VehicleFoundRoute> {
  const route = await lookupVehicleAndBuildFoundRoute("KA 03 MX 2147");

  return buildVehicleFoundRoute(route.params.registrationNumber);
}
