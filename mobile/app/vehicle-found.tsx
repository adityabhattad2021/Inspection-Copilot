import { Stack, useLocalSearchParams } from "expo-router";

import { VehicleFoundScreen } from "@/src/features/lookup/vehicle-found-screen";

export default function VehicleFoundRoute() {
  const { registrationNumber } = useLocalSearchParams<{
    registrationNumber?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <VehicleFoundScreen
        registrationNumber={
          typeof registrationNumber === "string" ? registrationNumber : ""
        }
      />
    </>
  );
}
