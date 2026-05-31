import { useState } from "react";
import { Stack, router } from "expo-router";

import { ApiError, createProfile } from "@/src/api/client";
import { InspectorOnboardingScreen } from "@/src/features/onboarding/inspector-onboarding-screen";
import type { InspectorProfile } from "@/src/features/onboarding/profile";
import { saveCachedProfile } from "@/src/features/onboarding/profile-storage";

export default function OnboardingRoute() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleContinue(profile: InspectorProfile) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const savedProfile = await createProfile({
        languageCode: profile.languageCode,
        name: profile.inspectorName,
      });
      await saveCachedProfile(savedProfile);
      router.replace("/");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Could not save profile. Check backend and try again.";
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <InspectorOnboardingScreen
        errorMessage={errorMessage}
        isSubmitting={isSubmitting}
        onContinue={handleContinue}
      />
    </>
  );
}
