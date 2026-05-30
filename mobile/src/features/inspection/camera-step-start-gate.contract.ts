import { getCameraStepStartBlockers } from "./camera-step-start-gate";

export function cameraStepStartGateContract() {
  const blockers = getCameraStepStartBlockers({
    hasActiveStep: true,
    hasSession: true,
    isGreetingActive: false,
    isInstructionAlreadySent: false,
    isLoading: false,
    isRealtimeCameraStep: true,
    isVoiceReady: true,
    isVisionCameraReady: false,
    stepNeedsObservation: false,
  });

  if (blockers.length > 0) {
    throw new Error(
      "Camera page guidance must not wait for native camera readiness.",
    );
  }

  return blockers;
}
