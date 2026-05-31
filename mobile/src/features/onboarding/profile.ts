export const SUPPORTED_INSTRUCTION_LANGUAGES = [
  {
    code: "en-IN",
    label: "English",
    voiceLabel: "English",
    sampleInstruction:
      "Move two steps back. I need the full bumper and front-left tyre.",
  },
  {
    code: "hi-IN",
    label: "Hindi",
    voiceLabel: "Hindi",
    sampleInstruction:
      "Do kadam peeche jaiye. Poora bumper aur front-left tyre dikhna chahiye.",
  },
  {
    code: "kn-IN",
    label: "Kannada",
    voiceLabel: "Kannada",
    sampleInstruction:
      "Eradu hejje hindakke hogi. Full bumper mattu front-left tyre torisi.",
  },
  {
    code: "hinglish",
    label: "Hinglish",
    voiceLabel: "Hinglish",
    sampleInstruction:
      "Thoda peeche ho jaiye. Full bumper aur front-left tyre frame mein chahiye.",
  },
] as const;

export const ONBOARDING_STEPS = [
  { id: "narrative", label: "Intro" },
  { id: "name", label: "Name" },
  { id: "language", label: "Language" },
] as const;

export type InstructionLanguage =
  (typeof SUPPORTED_INSTRUCTION_LANGUAGES)[number];
export type InstructionLanguageCode = InstructionLanguage["code"];
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export type InspectorProfile = {
  inspectorName: string;
  languageCode: InstructionLanguageCode;
  languageLabel: string;
  voiceLabel: string;
};

export type SavedInspectorProfile = InspectorProfile & {
  profileId: string;
};

type CreateInspectorProfileInput = {
  inspectorName: string;
  languageCode: InstructionLanguageCode;
};

export function isInstructionLanguageCode(
  value: string | undefined,
): value is InstructionLanguageCode {
  return SUPPORTED_INSTRUCTION_LANGUAGES.some(
    (language) => language.code === value,
  );
}

export function getInstructionLanguage(
  languageCode: InstructionLanguageCode,
): InstructionLanguage {
  return (
    SUPPORTED_INSTRUCTION_LANGUAGES.find(
      (language) => language.code === languageCode,
    ) ?? SUPPORTED_INSTRUCTION_LANGUAGES[0]
  );
}

export function createInspectorProfile({
  inspectorName,
  languageCode,
}: CreateInspectorProfileInput): InspectorProfile {
  const language = getInstructionLanguage(languageCode);

  return {
    inspectorName: inspectorName.trim(),
    languageCode: language.code,
    languageLabel: language.label,
    voiceLabel: language.voiceLabel,
  };
}

export function isSavedInspectorProfile(value: unknown): value is SavedInspectorProfile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SavedInspectorProfile>;

  return (
    typeof candidate.profileId === "string" &&
    candidate.profileId.length > 0 &&
    typeof candidate.inspectorName === "string" &&
    candidate.inspectorName.length > 0 &&
    isInstructionLanguageCode(candidate.languageCode) &&
    typeof candidate.languageLabel === "string" &&
    candidate.languageLabel.length > 0 &&
    typeof candidate.voiceLabel === "string" &&
    candidate.voiceLabel.length > 0
  );
}
