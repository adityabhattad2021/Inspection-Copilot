import {
  buildModelViewerHtml,
  parseModelViewerMessage,
  resolveModelSourceUri,
  type ModelSource,
} from "react-native-model-viewer-webview";

export function vehicleModelPackageContract() {
  const assetSource = {
    localUri: "file:///cache/car.glb",
    uri: "https://example.com/car.glb",
  } satisfies ModelSource;
  const html = buildModelViewerHtml({
    autoRotate: true,
    cameraControls: true,
    cameraOrbit: "35deg 66deg 6.2m",
    disablePan: true,
    modelViewerScript: "customElements.define('model-viewer', class extends HTMLElement {})",
    modelUri: "data:model/gltf-binary;base64,example",
  });
  const loaded = parseModelViewerMessage(
    JSON.stringify({ type: "model-loaded", message: "ready" }),
  );
  const rawError = parseModelViewerMessage("plain webview error");

  return {
    assetSourceUri: resolveModelSourceUri(assetSource),
    htmlIncludesCameraControls: html.includes("camera-controls"),
    htmlIncludesEscapedModelUri: html.includes("data:model/gltf-binary;base64,example"),
    htmlIncludesInlineScript: html.includes("customElements.define"),
    loadedType: loaded.type,
    rawErrorMessage: rawError.message,
    rawErrorType: rawError.type,
  };
}
