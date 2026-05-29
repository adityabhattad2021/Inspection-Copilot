import {
  ApiError,
  type InspectionSession,
  type InspectionStep,
} from "@/src/api/client";
import type { ProgressStep } from "@/src/components/ui";

export function getInspectionErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load this inspection session.";
}

export function findActiveInspectionStep(
  session: InspectionSession,
): InspectionStep | null {
  return (
    session.plan.steps.find((step) =>
      ["active", "needs_observation"].includes(step.status),
    ) ?? null
  );
}

export function getProgressStatus(
  step: InspectionStep,
): ProgressStep["status"] {
  if (step.status === "complete") {
    return "complete";
  }
  if (["active", "needs_observation"].includes(step.status)) {
    return "active";
  }
  return "pending";
}

export function getVehicleTitle(session: InspectionSession) {
  return `${session.vehicle.year} ${session.vehicle.make} ${session.vehicle.model}`;
}

export function getProgressSteps(session: InspectionSession): ProgressStep[] {
  return session.plan.steps.map((step, index) => ({
    id: step.id,
    label: `${index + 1}`,
    status: getProgressStatus(step),
  }));
}

export function getInspectionStepChangedEvent(
  step: InspectionStep,
  index: number,
) {
  const expectedParts =
    step.expectedParts.length > 0
      ? `Expected parts: ${step.expectedParts.join(", ")}.`
      : "Expected parts: none.";
  const action =
    step.status === "needs_observation"
      ? step.id === "lhs-front-door"
        ? "Ask the jockey one short question to classify the visible door mark as scratch, dent, rust, or dirt, then keep listening for the answer."
        : "Ask the jockey one short question for the field observation, then keep listening for the answer."
      : step.kind === "engine-guided"
        ? "Guide the engine-sound check one short step at a time. The jockey can either tap the visible options or answer aloud; if they answer aloud, record knocking, rattling, idle vibration, and exhaust sound."
        : "Tell the jockey what to do for this step in your own short field-inspection words.";

  return [
    `STEP_CHANGED ${index + 1}: ${step.fieldName}.`,
    `Step id: ${step.id}.`,
    `Step kind: ${step.kind}.`,
    `Step status: ${step.status}.`,
    `Inspection instruction: ${step.instructions}`,
    expectedParts,
    action,
    "This is a hidden lifecycle event, not a script.",
  ].join(" ");
}

export function getRealtimeCameraStepStartEvent(
  step: InspectionStep,
  index: number,
) {
  return [
    getInspectionStepChangedEvent(step, index),
    "The Android camera preview is live for the jockey.",
    "Do not judge the camera preview from STEP_CHANGED.",
    "Ask the jockey to tap Capture when the requested view is framed.",
    "Wait for CAPTURED_PHOTO_REVIEW before deciding whether to accept or retake.",
  ].join(" ");
}

export function getCapturedPhotoReviewEvent(step: InspectionStep) {
  return [
    `CAPTURED_PHOTO_REVIEW for ${step.fieldName}.`,
    `Step id: ${step.id}.`,
    `Required parts: ${step.expectedParts.join(", ")}.`,
    "Review the uploaded still photo now.",
    "If the photo is acceptable, call accept_photo with this stepId.",
    "If the photo needs a retake, do not call any tool; speak one direct physical fix.",
    "Speak only the next physical action, with no setup or debug wording.",
  ].join(" ");
}
