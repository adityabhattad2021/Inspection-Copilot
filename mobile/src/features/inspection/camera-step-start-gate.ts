export type CameraStepStartBlocker =
  | "loading"
  | "greeting_active"
  | "no_session"
  | "no_active_step"
  | "not_realtime_camera_step"
  | "needs_observation"
  | "voice_not_ready"
  | "already_sent";

type CameraStepStartGateInput = {
  hasActiveStep: boolean;
  hasSession: boolean;
  isGreetingActive: boolean;
  isInstructionAlreadySent: boolean;
  isLoading: boolean;
  isRealtimeCameraStep: boolean;
  // Native readiness gates capture only; page guidance can start while preview warms up.
  isVisionCameraReady: boolean;
  isVoiceReady: boolean;
  stepNeedsObservation: boolean;
};

export function getCameraStepStartBlockers({
  hasActiveStep,
  hasSession,
  isGreetingActive,
  isInstructionAlreadySent,
  isLoading,
  isRealtimeCameraStep,
  isVoiceReady,
  stepNeedsObservation,
}: CameraStepStartGateInput): CameraStepStartBlocker[] {
  const blockers: CameraStepStartBlocker[] = [];
  if (isLoading) {
    blockers.push("loading");
  }
  if (isGreetingActive) {
    blockers.push("greeting_active");
  }
  if (!hasSession) {
    blockers.push("no_session");
  }
  if (!hasActiveStep) {
    blockers.push("no_active_step");
  }
  if (!isRealtimeCameraStep) {
    blockers.push("not_realtime_camera_step");
  }
  if (stepNeedsObservation) {
    blockers.push("needs_observation");
  }
  if (!isVoiceReady) {
    blockers.push("voice_not_ready");
  }
  if (isInstructionAlreadySent) {
    blockers.push("already_sent");
  }

  return blockers;
}
