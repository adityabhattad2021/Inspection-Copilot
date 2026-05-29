const HIDDEN_AGENT_MESSAGE_PREFIXES = [
  "CAPTURED_PHOTO_REVIEW",
  "FRAME_TICK",
  "INSPECTION_COMPLETED.",
  "STEP_CHANGED",
  "SYSTEM_EVENT:",
] as const;

const STRIPPED_AGENT_MESSAGE_PREFIXES = ["SYSTEM_GUIDANCE:"] as const;

export function sanitizeAgentMessageForDisplay(message: string) {
  const trimmedMessage = message.trimStart();
  const upperMessage = trimmedMessage.toUpperCase();

  for (const prefix of STRIPPED_AGENT_MESSAGE_PREFIXES) {
    if (upperMessage.startsWith(prefix)) {
      return trimmedMessage.slice(prefix.length).trimStart();
    }
    if (prefix.startsWith(upperMessage)) {
      return "";
    }
  }

  for (const prefix of HIDDEN_AGENT_MESSAGE_PREFIXES) {
    if (upperMessage.startsWith(prefix) || prefix.startsWith(upperMessage)) {
      return "";
    }
  }

  return message;
}
