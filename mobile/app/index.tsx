import { Redirect, Stack, useLocalSearchParams } from "expo-router";

import { VehicleLookupScreen } from "@/src/features/lookup/vehicle-lookup-screen";
import {
  createJockeyProfile,
  isInstructionLanguageCode,
} from "@/src/features/onboarding/profile";

export default function Index() {
  const { jockeyName, languageCode } = useLocalSearchParams<{
    jockeyName?: string;
    languageCode?: string;
  }>();

  if (!jockeyName || !isInstructionLanguageCode(languageCode)) {
    return <Redirect href={"/onboarding" as never} />;
  }

  const jockeyProfile = createJockeyProfile({
    jockeyName,
    languageCode,
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <VehicleLookupScreen jockeyProfile={jockeyProfile} />
    </>
  );
}
