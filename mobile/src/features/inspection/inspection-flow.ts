import {
  ApiError,
  type InspectionSession,
  type InspectionStep,
} from "@/src/api/client";
import type { ProgressStep } from "@/src/components/ui";

export const ENGINE_TRANSCRIPT =
  "No knocking. Mild vibration at idle. Exhaust sounds normal.";

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

export function getInspectionStepVoiceInstruction(
  step: InspectionStep,
  index: number,
) {
  const stepNumber = index + 1;

  if (step.kind === "engine-guided") {
    return `Step ${stepNumber}: ${step.fieldName}. ${step.instructions}`;
  }

  if (step.kind === "photo") {
    return `Step ${stepNumber}: ${step.fieldName}. ${step.instructions} I will tell you when to hold.`;
  }

  return `Step ${stepNumber}: ${step.fieldName}. ${step.instructions}`;
}
