import {
  createInspectionSession,
  lookupVehicle,
  type InspectionSession,
  type VehicleProfile,
} from "@/src/api/client";

export async function lookupFlowContract(): Promise<InspectionSession> {
  const vehicle: VehicleProfile = await lookupVehicle("KA03MX2147");
  return createInspectionSession(vehicle.registrationNumber);
}
