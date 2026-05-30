import {
  buildVisionCameraPhotoReviewOptions,
  encodeJpegBytesToDataUrl,
} from "./vision-camera-photo-capture";

export function visionCameraPhotoCapturePayloadContract() {
  const imageBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]).buffer;
  const dataUrl = encodeJpegBytesToDataUrl(imageBytes);

  if (dataUrl !== "data:image/jpeg;base64,/9j/2Q==") {
    throw new Error("VisionCamera JPEG bytes must be encoded as a JPEG data URL.");
  }

  const options = buildVisionCameraPhotoReviewOptions({
    imageBytes,
    sourceUri: "file:///cache/front-main.jpg",
    stepId: "front-main",
  });

  if (options.imageDataUrl !== dataUrl) {
    throw new Error("Captured photo review must send the encoded VisionCamera image.");
  }

  if (options.sourceUri !== "file:///cache/front-main.jpg") {
    throw new Error("Captured photo review must preserve the local source URI.");
  }

  if (options.stepId !== "front-main") {
    throw new Error("Captured photo review must keep the active step id.");
  }

  return options;
}
