import { DEFAULT_VEHICLE_MODEL_ASSET } from "@/src/features/lookup/vehicle-model-assets";

const MODEL_VIEWER_CDN_URL =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/4.2.0/model-viewer.min.js";

export const VEHICLE_MODEL_FILE_NAME = "kenney-suv-white.glb";

export function getVehicleModelViewerHtml(
  modelUri = DEFAULT_VEHICLE_MODEL_ASSET.modelUri,
) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <script type="module" src="${MODEL_VIEWER_CDN_URL}"></script>
    <script>
      function postStatus(type, message) {
        window.ReactNativeWebView &&
          window.ReactNativeWebView.postMessage(JSON.stringify({ type, message }));
      }

      window.addEventListener("error", function (event) {
        postStatus("page-error", event.message || "Page error");
      });

      window.addEventListener("unhandledrejection", function (event) {
        postStatus("page-error", String(event.reason || "Unhandled rejection"));
      });

      window.addEventListener("DOMContentLoaded", function () {
        var viewer = document.querySelector("model-viewer");
        postStatus("dom-ready", "Model viewer DOM ready");

        if (!viewer) {
          postStatus("model-error", "model-viewer element was not created");
          return;
        }

        viewer.addEventListener("load", function () {
          postStatus("model-loaded", "3D model loaded");
        });

        viewer.addEventListener("error", function (event) {
          var detail = event.detail || {};
          var sourceError = detail.sourceError || {};
          postStatus(
            "model-error",
            sourceError.message || detail.message || "3D model failed to load"
          );
        });
      });
    </script>
    <style>
      html,
      body {
        background: #ffffff;
        height: 100%;
        margin: 0;
        overflow: hidden;
        width: 100%;
      }

      model-viewer {
        --poster-color: #ffffff;
        background: #ffffff;
        height: 100%;
        width: 100%;
      }

    </style>
  </head>
  <body>
    <model-viewer
      src="${modelUri}"
      camera-controls
      auto-rotate
      auto-rotate-delay="0"
      rotation-per-second="26deg"
      interaction-prompt="none"
      camera-orbit="35deg 66deg 6.2m"
      min-camera-orbit="auto auto 4m"
      max-camera-orbit="auto auto 9m"
      shadow-intensity="0.35"
      exposure="1.05"
      disable-pan
    ></model-viewer>
  </body>
</html>`;
}
