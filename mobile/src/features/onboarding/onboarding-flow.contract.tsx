import { JockeyOnboardingScreen } from "@/src/features/onboarding/jockey-onboarding-screen";
import {
  ONBOARDING_STEPS,
  createJockeyProfile,
  type OnboardingStepId,
  SUPPORTED_INSTRUCTION_LANGUAGES,
} from "@/src/features/onboarding/profile";
import { VehicleLookupScreen } from "@/src/features/lookup/vehicle-lookup-screen";

const expectedStepOrder: readonly OnboardingStepId[] = [
  "narrative",
  "name",
  "language",
];
const demoProfile = createJockeyProfile({
  jockeyName: "Aditya",
  languageCode: SUPPORTED_INSTRUCTION_LANGUAGES[0].code,
});

if (ONBOARDING_STEPS.length !== expectedStepOrder.length) {
  throw new Error("Onboarding should stay a focused 3-step flow.");
}

export function OnboardingFlowContract() {
  return (
    <>
      <JockeyOnboardingScreen onContinue={() => {}} />
      <VehicleLookupScreen jockeyProfile={demoProfile} />
    </>
  );
}
