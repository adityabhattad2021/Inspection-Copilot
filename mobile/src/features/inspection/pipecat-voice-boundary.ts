import type {
  BotOutputData,
  PipecatClient as PipecatClientInstance,
  PipecatClientOptions,
  RTVIMessage,
  TranscriptData,
} from "@pipecat-ai/client-js";

export type InspectionVoiceEvent =
  | {
      text: string;
      type: "agent-message";
    }
  | {
      type: "agent-speaking-started";
    }
  | {
      type: "agent-speaking-stopped";
    }
  | {
      text: string;
      type: "user-transcript";
    };

export type InspectionVoiceConnectRequest = {
  sessionId: string;
  startUrl: string;
  jockeyName?: string;
  languageCode?: string;
};

export type InspectionVoiceDriver = {
  connect: (request: InspectionVoiceConnectRequest) => Promise<void>;
  disconnect: () => Promise<void>;
  sendAgentMessage: (text: string) => Promise<void>;
};

export const PIPECAT_VOICE_BOUNDARY = {
  provider: "pipecat",
  transport: "small-webrtc",
} as const;

function buildStartRequestBody(request: InspectionVoiceConnectRequest) {
  const body: Record<string, string> = {
    sessionId: request.sessionId,
  };

  if (request.jockeyName) {
    body.jockeyName = request.jockeyName;
  }
  if (request.languageCode) {
    body.languageCode = request.languageCode;
  }

  return body;
}

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
  return createNativePipecatVoiceDriver(onEvent);
}

function createNativePipecatVoiceDriver(
  onEvent: (event: InspectionVoiceEvent) => void,
): InspectionVoiceDriver {
  let client: PipecatClientInstance | null = null;
  let botTranscript = "";
  let isBotSpeaking = false;

  return {
    async connect(request: InspectionVoiceConnectRequest) {
      const [
        { PipecatClient },
        { DailyMediaManager },
        { RNSmallWebRTCTransport },
      ] = await Promise.all([
        import("@pipecat-ai/client-js"),
        import("@pipecat-ai/react-native-daily-media-manager"),
        import("@pipecat-ai/react-native-small-webrtc-transport"),
      ]);

      const nativeTransport = new RNSmallWebRTCTransport({
        mediaManager: new DailyMediaManager(),
      });
      const transport =
        nativeTransport as unknown as PipecatClientOptions["transport"];

      client = new PipecatClient({
        callbacks: {
          onBotStartedSpeaking: () => {
            if (isBotSpeaking) {
              return;
            }

            isBotSpeaking = true;
            botTranscript = "";
            onEvent({ type: "agent-speaking-started" });
          },
          onBotOutput: (data: BotOutputData) => {
            if (!data.spoken || !data.text) {
              return;
            }

            botTranscript += data.text;
            onEvent({ text: botTranscript, type: "agent-message" });
          },
          onBotStoppedSpeaking: () => {
            isBotSpeaking = false;
            onEvent({ type: "agent-speaking-stopped" });
          },
          onError: (message: RTVIMessage) => {
            onEvent({ text: messageToText(message), type: "agent-message" });
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

      await client.initDevices();
      await client.startBotAndConnect({
        endpoint: request.startUrl,
        requestData: {
          body: buildStartRequestBody(request),
        },
      });
    },
    async disconnect() {
      await client?.disconnect();
      client = null;
    },
    async sendAgentMessage(text: string) {
      if (!client) {
        throw new Error("Realtime voice client is not connected.");
      }

      await client.sendText(`SYSTEM_GUIDANCE: ${text}`, {
        audio_response: true,
        run_immediately: true,
      });
    },
  };
}
