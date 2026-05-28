import { Stack, useLocalSearchParams } from "expo-router";

import { InspectionScreen } from "@/src/features/inspection/inspection-screen";

export default function InspectionRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <InspectionScreen
        sessionId={typeof sessionId === "string" ? sessionId : ""}
      />
    </>
  );
}
