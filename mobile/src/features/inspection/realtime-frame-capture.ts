import { NativeModules, Platform } from "react-native";

type RealtimeFrameCaptureOptions = {
  jpegQuality?: number;
  maxWidth?: number;
  timeoutMs?: number;
};

export type CapturedRealtimeFrame = {
  bytes: number;
  dataUrl: string;
  height: number;
  mimeType: "image/jpeg";
  path: string;
  uri: string;
  width: number;
};

type RealtimeFrameCaptureNativeModule = {
  captureVideoViewFrame: (
    viewTag: number,
    options: RealtimeFrameCaptureOptions,
  ) => Promise<CapturedRealtimeFrame>;
};

const CAPTURE_JPEG_QUALITY = 86;
const CAPTURE_MAX_WIDTH = 1280;
const CAPTURE_TIMEOUT_MS = 5000;
const CAPTURE_JS_TIMEOUT_BUFFER_MS = 500;

const nativeFrameCapture = NativeModules.RealtimeFrameCaptureModule as
  | RealtimeFrameCaptureNativeModule
  | undefined;

export async function captureRealtimeFrame(
  videoViewTag: number,
): Promise<CapturedRealtimeFrame> {
  if (Platform.OS !== "android") {
    throw new Error("Realtime camera capture is only available on Android.");
  }
  if (!nativeFrameCapture) {
    throw new Error("Realtime camera capture module is not available.");
  }
  if (!Number.isFinite(videoViewTag)) {
    throw new Error("Realtime camera view is not ready.");
  }

  return withTimeout(
    nativeFrameCapture.captureVideoViewFrame(videoViewTag, {
      jpegQuality: CAPTURE_JPEG_QUALITY,
      maxWidth: CAPTURE_MAX_WIDTH,
      timeoutMs: CAPTURE_TIMEOUT_MS,
    }),
    CAPTURE_TIMEOUT_MS + CAPTURE_JS_TIMEOUT_BUFFER_MS,
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error("Realtime camera capture timed out."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
