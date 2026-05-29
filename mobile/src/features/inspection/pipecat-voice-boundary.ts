import type {
  BotOutputData,
  Participant,
  PipecatClient as PipecatClientInstance,
  PipecatClientOptions,
  RTVIMessage,
  TranscriptData,
} from "@pipecat-ai/client-js";
import type {
  MediaDeviceInfo,
  MediaStreamTrack as DailyMediaStreamTrack,
} from "@daily-co/react-native-webrtc";
import type { RNSmallWebRTCTransport as RNSmallWebRTCTransportInstance } from "@pipecat-ai/react-native-small-webrtc-transport";

export type AgentProcessingPhase = "function" | "llm" | "tts";

export type InspectionVoiceEvent =
  | {
      text: string;
      type: "agent-message";
    }
  | {
      phase: AgentProcessingPhase;
      type: "agent-processing-started";
    }
  | {
      phase: AgentProcessingPhase;
      type: "agent-processing-stopped";
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
    }
  | {
      stepId: string;
      type: "capture-requested";
    }
  | {
      contentPreview: string;
      type: "inspection-control-ack";
    }
  | {
      error: string;
      type: "inspection-control-error";
    }
  | {
      type: "local-video-track";
      videoTrack: DailyMediaStreamTrack | null;
    }
  | {
      type: "voice-ready";
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
  sendControlEvent: (text: string) => Promise<void>;
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

function getCaptureStepId(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const command = "command" in data ? data.command : null;
  const stepId = "stepId" in data ? data.stepId : null;
  if (command === "capture_now" && typeof stepId === "string") {
    return stepId;
  }

  return null;
}

function getInspectionControlAck(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const type = "type" in data ? data.type : null;
  const contentPreview = "contentPreview" in data ? data.contentPreview : null;
  if (type === "inspection_control_ack") {
    return typeof contentPreview === "string" ? contentPreview : "";
  }

  return null;
}

function getInspectionControlError(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const type = "type" in data ? data.type : null;
  const error = "error" in data ? data.error : null;
  if (type === "inspection_control_error") {
    return typeof error === "string" ? error : "Unknown inspection control error.";
  }

  return null;
}

function isLocalParticipant(participant?: Participant) {
  return Boolean(participant?.local);
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getTrackFacingMode(track: DailyMediaStreamTrack) {
  const settingsFacingMode = track.getSettings().facingMode;
  if (settingsFacingMode) {
    return settingsFacingMode;
  }

  try {
    return String(track._getCameraFacingMode?.() ?? "");
  } catch {
    return "";
  }
}

function selectBackCamera(cameras: readonly MediaDeviceInfo[]) {
  return (
    cameras.find((camera) => /back|rear|environment/i.test(camera.label)) ??
    null
  );
}

const INSPECTION_CONTROL_MESSAGE_TYPE = "inspection-control";
const INSPECTION_LOG_PREFIX = "[inspection-rtvi]";
const INSPECTION_LOG_PREVIEW_LENGTH = 180;

function previewText(text: string) {
  return text.length > INSPECTION_LOG_PREVIEW_LENGTH
    ? `${text.slice(0, INSPECTION_LOG_PREVIEW_LENGTH)}...`
    : text;
}

function logInspectionRtvi(event: string, data?: unknown) {
  if (data === undefined) {
    console.log(INSPECTION_LOG_PREFIX, event);
    return;
  }

  console.log(INSPECTION_LOG_PREFIX, event, data);
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
  let nativeTransport: RNSmallWebRTCTransportInstance | null = null;
  let botTranscript = "";
  let isBotSpeaking = false;

  function emitLocalVideoTrack() {
    const videoTrack = (nativeTransport?.tracks().local.video ??
      null) as DailyMediaStreamTrack | null;
    onEvent({ type: "local-video-track", videoTrack });
  }

  async function preferBackCamera() {
    if (!nativeTransport) {
      return;
    }

    const videoTrack = nativeTransport.tracks().local
      .video as DailyMediaStreamTrack | undefined;
    logInspectionRtvi("prefer-back-camera:start", {
      facingMode: videoTrack ? getTrackFacingMode(videoTrack) : null,
      hasVideoTrack: Boolean(videoTrack),
    });

    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({ facingMode: "environment" });
        logInspectionRtvi("prefer-back-camera:constraints-applied", {
          facingMode: getTrackFacingMode(videoTrack),
        });
      } catch {
        // Some Android WebRTC builds ignore facingMode constraints. We fall
        // through to the explicit camera switch/device selection below.
        logInspectionRtvi("prefer-back-camera:constraints-ignored");
      }

      if (getTrackFacingMode(videoTrack) === "environment") {
        emitLocalVideoTrack();
        logInspectionRtvi("prefer-back-camera:already-environment");
        return;
      }

      if (getTrackFacingMode(videoTrack) === "user") {
        videoTrack._switchCamera();
        await wait(300);
        emitLocalVideoTrack();
        logInspectionRtvi("prefer-back-camera:switch-camera", {
          facingMode: getTrackFacingMode(videoTrack),
        });
        if (getTrackFacingMode(videoTrack) === "environment") {
          return;
        }
      }
    }

    const backCamera = selectBackCamera(await nativeTransport.getAllCams());
    if (backCamera) {
      nativeTransport.updateCam(backCamera.deviceId);
      await wait(450);
      emitLocalVideoTrack();
      logInspectionRtvi("prefer-back-camera:update-cam", {
        deviceId: backCamera.deviceId,
        label: backCamera.label,
      });
    } else {
      logInspectionRtvi("prefer-back-camera:no-back-camera-found");
    }
  }

  function sendInspectionControlMessage(content: string) {
    if (!client) {
      throw new Error("Realtime voice client is not connected.");
    }

    logInspectionRtvi("send inspection-control", previewText(content));
    client.sendClientMessage(INSPECTION_CONTROL_MESSAGE_TYPE, {
      content,
    });
  }

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

      nativeTransport = new RNSmallWebRTCTransport({
        mediaManager: new DailyMediaManager(),
      });
      const transport =
        nativeTransport as unknown as PipecatClientOptions["transport"];

      client = new PipecatClient({
        callbacks: {
          onBotReady: () => {
            logInspectionRtvi("bot-ready");
            onEvent({ type: "voice-ready" });
          },
          onBotLlmStarted: () => {
            logInspectionRtvi("bot-llm-started");
            onEvent({ phase: "llm", type: "agent-processing-started" });
          },
          onBotLlmStopped: () => {
            logInspectionRtvi("bot-llm-stopped");
            onEvent({ phase: "llm", type: "agent-processing-stopped" });
          },
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
          onBotTtsStarted: () => {
            logInspectionRtvi("bot-tts-started");
            onEvent({ phase: "tts", type: "agent-processing-started" });
          },
          onBotTtsStopped: () => {
            logInspectionRtvi("bot-tts-stopped");
            onEvent({ phase: "tts", type: "agent-processing-stopped" });
          },
          onLLMFunctionCallStarted: () => {
            logInspectionRtvi("llm-function-call-started");
            onEvent({ phase: "function", type: "agent-processing-started" });
          },
          onLLMFunctionCallStopped: () => {
            logInspectionRtvi("llm-function-call-stopped");
            onEvent({ phase: "function", type: "agent-processing-stopped" });
          },
          onServerMessage: (data: unknown) => {
            logInspectionRtvi("server-message", data);
            const ack = getInspectionControlAck(data);
            if (ack !== null) {
              onEvent({ contentPreview: ack, type: "inspection-control-ack" });
              return;
            }

            const controlError = getInspectionControlError(data);
            if (controlError) {
              onEvent({
                error: controlError,
                type: "inspection-control-error",
              });
              return;
            }

            const stepId = getCaptureStepId(data);
            if (stepId) {
              onEvent({ stepId, type: "capture-requested" });
            }
          },
          onError: (message: RTVIMessage) => {
            logInspectionRtvi("error", {
              data: message.data,
              type: message.type,
            });
            onEvent({ text: messageToText(message), type: "agent-message" });
          },
          onMessageError: (message: RTVIMessage) => {
            logInspectionRtvi("message-error", {
              data: message.data,
              type: message.type,
            });
          },
          onTrackStarted: (_track, participant?: Participant) => {
            if (isLocalParticipant(participant)) {
              logInspectionRtvi("local-track-started");
              emitLocalVideoTrack();
            }
          },
          onTrackStopped: (_track, participant?: Participant) => {
            if (isLocalParticipant(participant)) {
              logInspectionRtvi("local-track-stopped");
              emitLocalVideoTrack();
            }
          },
          onTransportStateChanged: (state) => {
            logInspectionRtvi("transport-state", state);
          },
          onUserTranscript: (data: TranscriptData) => {
            if (data.final && data.text) {
              onEvent({ text: data.text, type: "user-transcript" });
            }
          },
        },
        enableCam: true,
        enableMic: true,
        transport,
      });

      await client.initDevices();
      await preferBackCamera();
      emitLocalVideoTrack();
      await client.startBotAndConnect({
        endpoint: request.startUrl,
        requestData: {
          body: buildStartRequestBody(request),
        },
      });
      emitLocalVideoTrack();
    },
    async disconnect() {
      logInspectionRtvi("disconnect");
      await client?.disconnect();
      client = null;
      nativeTransport = null;
      onEvent({ type: "local-video-track", videoTrack: null });
    },
    async sendAgentMessage(text: string) {
      sendInspectionControlMessage(`SYSTEM_GUIDANCE: ${text}`);
    },
    async sendControlEvent(text: string) {
      sendInspectionControlMessage(`SYSTEM_EVENT: ${text}`);
    },
  };
}
