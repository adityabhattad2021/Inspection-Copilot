import { DEFAULT_VEHICLE_MODEL_ASSET } from "@/src/features/lookup/vehicle-model-assets";
import { buildModelViewerHtml } from "react-native-model-viewer-webview";

const MODEL_VIEWER_CDN_URL =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/4.2.0/model-viewer.min.js";

export const VEHICLE_MODEL_FILE_NAME = "kenney-suv-white.glb";

export function getVehicleModelViewerHtml(
  modelUri = DEFAULT_VEHICLE_MODEL_ASSET.modelUri,
) {
  return buildModelViewerHtml({
    autoRotate: true,
    autoRotateDelay: 0,
    backgroundColor: "#ffffff",
    cameraControls: true,
    cameraOrbit: "35deg 66deg 6.2m",
    disablePan: true,
    exposure: 1.05,
    interactionPrompt: "none",
    maxCameraOrbit: "auto auto 9m",
    minCameraOrbit: "auto auto 4m",
    modelUri,
    modelViewerScriptUrl: MODEL_VIEWER_CDN_URL,
    posterColor: "#ffffff",
    rotationPerSecond: "26deg",
    shadowIntensity: 0.35,
  });
}
