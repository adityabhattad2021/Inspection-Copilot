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

type SmallWebRTCTransportInternals = {
  _handleTrackStarted?: (event: unknown) => Promise<void> | void;
  pc?: unknown;
};

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

function guardTrackEventsUntilPeerConnectionExists(
  nativeTransportSource: unknown,
  mediaManagerSource: unknown,
) {
  const nativeTransport =
    nativeTransportSource as SmallWebRTCTransportInternals;
  const mediaManager = mediaManagerSource as {
    onTrackStarted?: (event: unknown) => void;
  };
  const handleTrackStarted =
    nativeTransport._handleTrackStarted?.bind(nativeTransport);

  if (!handleTrackStarted) {
    return;
  }

  mediaManager.onTrackStarted = async (event: unknown) => {
    if (!nativeTransport.pc) {
      return;
    }

    await handleTrackStarted(event);
  };
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

      const mediaManager = new DailyMediaManager();
      const nativeTransport = new RNSmallWebRTCTransport({
        mediaManager,
      });
      guardTrackEventsUntilPeerConnectionExists(nativeTransport, mediaManager);
      const transport =
        nativeTransport as unknown as PipecatClientOptions["transport"];

      client = new PipecatClient({
        callbacks: {
          onBotOutput: (data: BotOutputData) => {
            if (data.text) {
              onEvent({ text: data.text, type: "agent-message" });
            }
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
