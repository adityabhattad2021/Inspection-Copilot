export type InspectionFrameTone = "clear" | "dark" | "issue" | "wide";

export type InspectionFrame = {
  key: string;
  label: string;
  note: string;
  tone: InspectionFrameTone;
};

export type InspectionStepMedia = {
  stepId: string;
  frames: readonly InspectionFrame[];
  observationTranscript?: string;
};

export const INSPECTION_STEP_MEDIA: readonly InspectionStepMedia[] = [
  {
    frames: [
      {
        key: "front-main-bad-cropped",
        label: "Cropped front",
        note: "Bumper edge and front-left tyre are missing.",
        tone: "wide",
      },
      {
        key: "front-main-good",
        label: "Front aligned",
        note: "Full bumper, bonnet line, headlight, and tyre are visible.",
        tone: "clear",
      },
    ],
    stepId: "front-main",
  },
  {
    frames: [
      {
        key: "rear-main-good",
        label: "Rear aligned",
        note: "Rear bumper, boot line, and tail lamps are visible.",
        tone: "clear",
      },
    ],
    stepId: "rear-main",
  },
  {
    frames: [
      {
        key: "dashboard-dark",
        label: "Cabin dark",
        note: "Dashboard is visible, odometer is hard to read.",
        tone: "dark",
      },
      {
        key: "dashboard-good",
        label: "Cluster readable",
        note: "Instrument cluster and odometer are readable.",
        tone: "clear",
      },
    ],
    stepId: "dashboard-odometer",
  },
] as const;

export function getInspectionStepMedia(stepId: string): InspectionStepMedia | null {
  return INSPECTION_STEP_MEDIA.find((step) => step.stepId === stepId) ?? null;
}
