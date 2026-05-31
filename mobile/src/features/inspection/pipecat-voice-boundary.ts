import type {
  BotOutputData,
  PipecatClient as PipecatClientInstance,
  PipecatClientOptions,
  RTVIMessage,
  TranscriptData,
} from "@pipecat-ai/client-js";
import type { MediaDeviceInfo } from "@daily-co/react-native-webrtc";
import type { RNSmallWebRTCTransport as RNSmallWebRTCTransportInstance } from "@pipecat-ai/react-native-small-webrtc-transport";
import type {
  InspectionSession,
  InspectionStep,
} from "@/src/api/client";

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
      readyToCapture: boolean;
      status: string;
      text: string;
      type: "frame-intervention";
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
      message: string;
      nextStep: InspectionStep | null;
      resultType: string;
      session: InspectionSession;
      type: "voice-session-updated";
    }
  | {
      type: "voice-ready";
    };

export type InspectionVoiceConnectRequest = {
  sessionId: string;
  startUrl: string;
  inspectorName?: string;
  languageCode?: string;
};

export type InspectionVoiceDriver = {
  connect: (request: InspectionVoiceConnectRequest) => Promise<void>;
  disconnect: () => Promise<void>;
  sendControlEvent: (
    text: string,
    options?: {
      imageDataUrl?: string;
      sourceUri?: string;
      stepId?: string;
    },
  ) => Promise<void>;
};

export const PIPECAT_VOICE_BOUNDARY = {
  provider: "pipecat",
  transport: "small-webrtc",
} as const;

function buildStartRequestBody(request: InspectionVoiceConnectRequest) {
  const body: Record<string, string> = {
    sessionId: request.sessionId,
  };

  if (request.inspectorName) {
    body.inspectorName = request.inspectorName;
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

export function buildPipecatErrorEvent(message: RTVIMessage): InspectionVoiceEvent {
  return {
    error: messageToText(message),
    type: "inspection-control-error",
  };
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

function getFrameIntervention(data: unknown): {
  readyToCapture: boolean;
  status: string;
  text: string;
} | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const type = "type" in data ? data.type : null;
  const message = "message" in data ? data.message : null;
  if (type !== "frame_intervention" || typeof message !== "string") {
    return null;
  }

  const status = "status" in data ? data.status : null;
  const readyToCapture = "readyToCapture" in data ? data.readyToCapture : null;

  return {
    readyToCapture: readyToCapture === true,
    status: typeof status === "string" ? status : "unknown",
    text: message,
  };
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

function getVoiceSessionUpdate(data: unknown): {
  message: string;
  nextStep: InspectionStep | null;
  resultType: string;
  session: InspectionSession;
} | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const type = "type" in data ? data.type : null;
  const session = "session" in data ? data.session : null;
  if (
    !["photo_acceptance", "observation", "engine"].includes(String(type)) ||
    !session ||
    typeof session !== "object"
  ) {
    return null;
  }

  const message = "message" in data ? data.message : null;
  const nextStep = "nextStep" in data ? data.nextStep : null;

  return {
    message: typeof message === "string" ? message : "",
    nextStep:
      nextStep && typeof nextStep === "object"
        ? (nextStep as InspectionStep)
        : null,
    resultType: String(type),
    session: session as InspectionSession,
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

const ANDROID_SPEAKERPHONE_DEVICE_ID = "SPEAKERPHONE";

export function selectSpeakerphone(speakers: readonly MediaDeviceInfo[]) {
  return (
    speakers.find(
      (speaker) => speaker.deviceId === ANDROID_SPEAKERPHONE_DEVICE_ID,
    ) ??
    speakers.find(
      (speaker) =>
        /speaker/i.test(speaker.label) &&
        !/bluetooth|earpiece|wired/i.test(speaker.label),
    ) ??
    null
  );
}

const INSPECTION_CONTROL_MESSAGE_TYPE = "inspection-control";
const INSPECTION_CONTROL_PHOTO_CHUNK_MESSAGE_TYPE =
  "inspection-control-photo-chunk";
const INSPECTION_CONTROL_PHOTO_CHUNK_SIZE = 24000;
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

function createPhotoTransferId() {
  return `photo_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function splitTextIntoChunks(text: string, chunkSize: number) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks;
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

  async function preferSpeakerphone() {
    if (!nativeTransport) {
      return;
    }

    try {
      const speakers = await nativeTransport.getAllSpeakers();
      const speakerphone = selectSpeakerphone(speakers);
      logInspectionRtvi("prefer-speakerphone:start", {
        availableSpeakers: speakers.map((speaker) => ({
          deviceId: speaker.deviceId,
          label: speaker.label,
        })),
        selectedDeviceId: speakerphone?.deviceId ?? null,
      });

      if (!speakerphone) {
        logInspectionRtvi("prefer-speakerphone:no-speakerphone-found");
        return;
      }

      nativeTransport.updateSpeaker(speakerphone.deviceId);
      await wait(150);
      logInspectionRtvi("prefer-speakerphone:selected", {
        deviceId: speakerphone.deviceId,
        label: speakerphone.label,
        selectedSpeaker: nativeTransport.selectedSpeaker,
      });
    } catch (error) {
      logInspectionRtvi("prefer-speakerphone:error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function sendInspectionControlMessage(
    content: string,
    options?: {
      imageDataUrl?: string;
      sourceUri?: string;
      stepId?: string;
    },
  ) {
    if (!client) {
      throw new Error("Realtime voice client is not connected.");
    }

    let imageTransferId: string | undefined;
    if (options?.imageDataUrl) {
      imageTransferId = createPhotoTransferId();
      const chunks = splitTextIntoChunks(
        options.imageDataUrl,
        INSPECTION_CONTROL_PHOTO_CHUNK_SIZE,
      );

      logInspectionRtvi("send inspection-control-photo-chunks", {
        chunkCount: chunks.length,
        imageCharacters: options.imageDataUrl.length,
        stepId: options.stepId ?? null,
        transferId: imageTransferId,
      });

      chunks.forEach((chunk, chunkIndex) => {
        client?.sendClientMessage(INSPECTION_CONTROL_PHOTO_CHUNK_MESSAGE_TYPE, {
          chunk,
          chunkCount: chunks.length,
          chunkIndex,
          transferId: imageTransferId,
        });
      });
    }

    logInspectionRtvi("send inspection-control", {
      hasPhoto: Boolean(imageTransferId),
      preview: previewText(content),
      stepId: options?.stepId ?? null,
    });
    client.sendClientMessage(INSPECTION_CONTROL_MESSAGE_TYPE, {
      content,
      imageTransferId,
      sourceUri: options?.sourceUri,
      stepId: options?.stepId,
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
            const frameIntervention = getFrameIntervention(data);
            if (frameIntervention) {
              onEvent({
                readyToCapture: frameIntervention.readyToCapture,
                status: frameIntervention.status,
                text: frameIntervention.text,
                type: "frame-intervention",
              });
              return;
            }

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

            const voiceSessionUpdate = getVoiceSessionUpdate(data);
            if (voiceSessionUpdate) {
              onEvent({
                message: voiceSessionUpdate.message,
                nextStep: voiceSessionUpdate.nextStep,
                resultType: voiceSessionUpdate.resultType,
                session: voiceSessionUpdate.session,
                type: "voice-session-updated",
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
            onEvent(buildPipecatErrorEvent(message));
          },
          onMessageError: (message: RTVIMessage) => {
            logInspectionRtvi("message-error", {
              data: message.data,
              type: message.type,
            });
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
        enableCam: false,
        enableMic: true,
        transport,
      });

      await client.initDevices();
      await preferSpeakerphone();
      await client.startBotAndConnect({
        endpoint: request.startUrl,
        requestData: {
          body: buildStartRequestBody(request),
        },
      });
      await preferSpeakerphone();
    },
    async disconnect() {
      logInspectionRtvi("disconnect");
      await client?.disconnect();
      client = null;
      nativeTransport = null;
    },
    async sendControlEvent(text: string, options) {
      sendInspectionControlMessage(`SYSTEM_EVENT: ${text}`, options);
    },
  };
}
