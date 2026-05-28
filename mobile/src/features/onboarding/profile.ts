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

export type JockeyProfile = {
  jockeyName: string;
  languageCode: InstructionLanguageCode;
  languageLabel: string;
  voiceLabel: string;
};

export type SavedJockeyProfile = JockeyProfile & {
  profileId: string;
};

type CreateJockeyProfileInput = {
  jockeyName: string;
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

export function createJockeyProfile({
  jockeyName,
  languageCode,
}: CreateJockeyProfileInput): JockeyProfile {
  const language = getInstructionLanguage(languageCode);

  return {
    jockeyName: jockeyName.trim(),
    languageCode: language.code,
    languageLabel: language.label,
    voiceLabel: language.voiceLabel,
  };
}

export function isSavedJockeyProfile(value: unknown): value is SavedJockeyProfile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SavedJockeyProfile>;

  return (
    typeof candidate.profileId === "string" &&
    candidate.profileId.length > 0 &&
    typeof candidate.jockeyName === "string" &&
    candidate.jockeyName.length > 0 &&
    isInstructionLanguageCode(candidate.languageCode) &&
    typeof candidate.languageLabel === "string" &&
    candidate.languageLabel.length > 0 &&
    typeof candidate.voiceLabel === "string" &&
    candidate.voiceLabel.length > 0
  );
}
