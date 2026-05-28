import { Stack, router } from "expo-router";

import { JockeyOnboardingScreen } from "@/src/features/onboarding/jockey-onboarding-screen";
import type { JockeyProfile } from "@/src/features/onboarding/profile";

export default function OnboardingRoute() {
  function handleContinue(profile: JockeyProfile) {
    router.replace({
      pathname: "/",
      params: {
        jockeyName: profile.jockeyName,
        languageCode: profile.languageCode,
      },
    });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <JockeyOnboardingScreen onContinue={handleContinue} />
    </>
  );
}
