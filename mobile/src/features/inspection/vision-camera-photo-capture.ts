import type { InspectionVoiceDriver } from "./pipecat-voice-boundary";

export type CapturedVisionCameraPhoto = {
  height: number;
  imageBytes: ArrayBuffer;
  sourceUri: string;
  width: number;
};

type CapturedPhotoReviewInput = {
  imageBytes: ArrayBuffer;
  sourceUri: string;
  stepId: string;
};

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodeJpegBytesToDataUrl(imageBytes: ArrayBuffer) {
  return `data:image/jpeg;base64,${encodeBytesToBase64(
    new Uint8Array(imageBytes),
  )}`;
}

export function buildVisionCameraPhotoReviewOptions({
  imageBytes,
  sourceUri,
  stepId,
}: CapturedPhotoReviewInput): NonNullable<
  Parameters<InspectionVoiceDriver["sendControlEvent"]>[1]
> {
  return {
    imageDataUrl: encodeJpegBytesToDataUrl(imageBytes),
    sourceUri,
    stepId,
  };
}

function encodeBytesToBase64(bytes: Uint8Array) {
  let output = "";
  let index = 0;

  for (; index + 2 < bytes.length; index += 3) {
    output += BASE64_ALPHABET[bytes[index] >> 2];
    output += BASE64_ALPHABET[((bytes[index] & 0x03) << 4) | (bytes[index + 1] >> 4)];
    output += BASE64_ALPHABET[((bytes[index + 1] & 0x0f) << 2) | (bytes[index + 2] >> 6)];
    output += BASE64_ALPHABET[bytes[index + 2] & 0x3f];
  }

  if (index < bytes.length) {
    output += BASE64_ALPHABET[bytes[index] >> 2];
    if (index + 1 < bytes.length) {
      output +=
        BASE64_ALPHABET[((bytes[index] & 0x03) << 4) | (bytes[index + 1] >> 4)];
      output += BASE64_ALPHABET[(bytes[index + 1] & 0x0f) << 2];
      output += "=";
    } else {
      output += BASE64_ALPHABET[(bytes[index] & 0x03) << 4];
      output += "==";
    }
  }

  return output;
}
