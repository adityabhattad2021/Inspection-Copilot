import type {
  BotOutputData,
  PipecatClient as PipecatClientInstance,
  PipecatClientOptions,
  RTVIMessage,
  TranscriptData,
  TransportState,
} from "@pipecat-ai/client-js";

export type InspectionVoiceEvent =
  | {
      text: string;
      type: "agent-message";
    }
  | {
      text: string;
      type: "user-transcript";
    };

export type InspectionVoiceDriver = {
  connect: (sessionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  sendAgentMessage: (text: string) => Promise<void>;
};

type VoiceDriverOptions = {
  endpoint: string;
  onEvent: (event: InspectionVoiceEvent) => void;
};

export const PIPECAT_VOICE_BOUNDARY = {
  fallback: "deterministic-inspection-ui",
  provider: "pipecat",
  transport: "small-webrtc-first-daily-later",
} as const;

const PIPECAT_START_ENDPOINT = process.env.EXPO_PUBLIC_PIPECAT_START_URL;

function messageToText(message: RTVIMessage) {
  const data = message.data;

  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
  ) {
    return data.message;
  }

  return "Pipecat voice transport error.";
}

export function createInspectionVoiceDriver(
  onEvent: (event: InspectionVoiceEvent) => void,
): InspectionVoiceDriver {
  if (!PIPECAT_START_ENDPOINT) {
    return createDemoInspectionVoiceDriver(onEvent);
  }

  return createNativePipecatVoiceDriver({
    endpoint: PIPECAT_START_ENDPOINT,
    onEvent,
  });
}

export function createDemoInspectionVoiceDriver(
  onEvent: (event: InspectionVoiceEvent) => void,
): InspectionVoiceDriver {
  return {
    async connect(sessionId: string) {
      onEvent({
        text: `Pipecat voice session ready for ${sessionId}.`,
        type: "agent-message",
      });
    },
    async disconnect() {
      return;
    },
    async sendAgentMessage(text: string) {
      onEvent({ text, type: "agent-message" });
    },
  };
}

function createNativePipecatVoiceDriver({
  endpoint,
  onEvent,
}: VoiceDriverOptions): InspectionVoiceDriver {
  let client: PipecatClientInstance | null = null;

  return {
    async connect(sessionId: string) {
      const [
        { PipecatClient },
        { DailyMediaManager },
        { RNSmallWebRTCTransport },
      ] = await Promise.all([
        import("@pipecat-ai/client-js"),
        import("@pipecat-ai/react-native-daily-media-manager"),
        import("@pipecat-ai/react-native-small-webrtc-transport"),
      ]);

      const transport = new RNSmallWebRTCTransport({
        mediaManager: new DailyMediaManager(),
      }) as unknown as PipecatClientOptions["transport"];

      client = new PipecatClient({
        callbacks: {
          onBotOutput: (data: BotOutputData) => {
            if (data.text) {
              onEvent({ text: data.text, type: "agent-message" });
            }
          },
          onBotReady: () => {
            onEvent({
              text: "Voice copilot is listening.",
              type: "agent-message",
            });
          },
          onError: (message: RTVIMessage) => {
            onEvent({ text: messageToText(message), type: "agent-message" });
          },
          onTransportStateChanged: (state: TransportState) => {
            if (state === "connecting" || state === "ready") {
              onEvent({
                text: `Voice transport ${state}.`,
                type: "agent-message",
              });
            }
          },
          onUserTranscript: (data: TranscriptData) => {
            if (data.final && data.text) {
              onEvent({ text: data.text, type: "user-transcript" });
            }
          },
        },
        enableCam: false,
        enableMic: true,
        transport,
      });

      await client.startBotAndConnect({
        endpoint,
        requestData: {
          sessionId,
        },
      });
    },
    async disconnect() {
      await client?.disconnect();
      client = null;
    },
    async sendAgentMessage(text: string) {
      await client?.sendText(text, {
        audio_response: false,
        run_immediately: false,
      });
    },
  };
}
