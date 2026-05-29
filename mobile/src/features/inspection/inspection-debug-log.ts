import { API_BASE_URL } from "@/src/api/client";

type InspectionDebugLogEvent = {
  event: string;
  payload?: unknown;
  screen?: string;
  sessionId?: string;
  stepId?: string;
};

const SHOULD_PERSIST_INSPECTION_DEBUG_LOGS =
  __DEV__ && process.env.EXPO_PUBLIC_INSPECTION_FLOW_LOG !== "0";

let hasWarnedInspectionLogFailure = false;

function toPayloadObject(payload: unknown): Record<string, unknown> {
  if (payload === undefined) {
    return {};
  }

  const payloadObject =
    payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : { value: payload };

  try {
    return JSON.parse(JSON.stringify(payloadObject)) as Record<string, unknown>;
  } catch {
    return { serializationError: "payload_not_json_serializable" };
  }
}

export function logInspectionFlowEvent(event: InspectionDebugLogEvent) {
  if (!SHOULD_PERSIST_INSPECTION_DEBUG_LOGS || !event.event.trim()) {
    return;
  }

  void fetch(`${API_BASE_URL}/debug/inspection-flow-log`, {
    body: JSON.stringify({
      event: event.event,
      payload: toPayloadObject(event.payload),
      screen: event.screen,
      sessionId: event.sessionId,
      stepId: event.stepId,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "POST",
  }).catch((error: unknown) => {
    if (hasWarnedInspectionLogFailure) {
      return;
    }

    hasWarnedInspectionLogFailure = true;
    if (error instanceof Error) {
      console.warn("[inspection-flow-log]", error.message);
      return;
    }

    console.warn("[inspection-flow-log]", "Unable to persist debug log event.");
  });
}
