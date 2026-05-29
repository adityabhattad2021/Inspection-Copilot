const GREETING_SETTLE_MS = 1100;
const MIN_GREETING_VISIBLE_MS = 2800;
const MAX_GREETING_VISIBLE_MS = 8500;
const SPEECH_BASE_MS = 900;
const SPEECH_MS_PER_WORD = 360;

export type InspectionGreetingGate = {
  firstOutputAt: number | null;
  hasSpeechStopped: boolean;
  isActive: boolean;
  lastOutputAt: number | null;
  text: string;
};

export function createInspectionGreetingGate(): InspectionGreetingGate {
  return {
    firstOutputAt: null,
    hasSpeechStopped: false,
    isActive: true,
    lastOutputAt: null,
    text: "",
  };
}

export function recordInspectionGreetingStarted(
  gate: InspectionGreetingGate,
): InspectionGreetingGate {
  if (!gate.isActive) {
    return gate;
  }

  return {
    ...gate,
    hasSpeechStopped: false,
  };
}

export function recordInspectionGreetingOutput(
  gate: InspectionGreetingGate,
  text: string,
  now: number,
): InspectionGreetingGate {
  if (!gate.isActive) {
    return gate;
  }

  return {
    ...gate,
    firstOutputAt: gate.firstOutputAt ?? now,
    lastOutputAt: now,
    text,
  };
}

export function recordInspectionGreetingStopped(
  gate: InspectionGreetingGate,
): InspectionGreetingGate {
  if (!gate.isActive) {
    return gate;
  }

  return {
    ...gate,
    hasSpeechStopped: true,
  };
}

export function finishInspectionGreeting(
  gate: InspectionGreetingGate,
): InspectionGreetingGate {
  return {
    ...gate,
    isActive: false,
  };
}

export function getInspectionGreetingHandoffDelayMs(
  gate: InspectionGreetingGate,
  now: number,
) {
  if (
    !gate.isActive ||
    !gate.hasSpeechStopped ||
    gate.firstOutputAt === null ||
    gate.lastOutputAt === null
  ) {
    return null;
  }

  const spokenEstimateRemaining = Math.max(
    0,
    estimateGreetingSpeechMs(gate.text) - (now - gate.firstOutputAt),
  );
  const quietRemaining = Math.max(0, GREETING_SETTLE_MS - (now - gate.lastOutputAt));

  return Math.max(spokenEstimateRemaining, quietRemaining);
}

function estimateGreetingSpeechMs(text: string) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const estimated = SPEECH_BASE_MS + wordCount * SPEECH_MS_PER_WORD;

  return Math.min(
    MAX_GREETING_VISIBLE_MS,
    Math.max(MIN_GREETING_VISIBLE_MS, estimated),
  );
}
