export type SampleFrameTone = "clear" | "dark" | "issue" | "wide";

export type SampleFrame = {
  key: string;
  label: string;
  note: string;
  tone: SampleFrameTone;
};

export type SampleStepMedia = {
  stepId: string;
  frames: readonly SampleFrame[];
  observationTranscript?: string;
};

export const SAMPLE_STEP_MEDIA: readonly SampleStepMedia[] = [
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
        key: "lhs-door-scratch",
        label: "Door mark",
        note: "Left front door and handle area are visible.",
        tone: "issue",
      },
    ],
    observationTranscript: "Minor scratch near the handle, no dent.",
    stepId: "lhs-front-door",
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

export function getSampleStepMedia(stepId: string): SampleStepMedia | null {
  return SAMPLE_STEP_MEDIA.find((step) => step.stepId === stepId) ?? null;
}
