import { useState } from "react";
import { Text, View } from "react-native";
import {
  ModelViewerWebView,
  type ModelViewerHtmlOptions,
  type ModelSource,
  type ModelViewerStatus,
} from "react-native-model-viewer-webview";

import { colors, spacing, typography } from "@/src/components/ui";
import { DEFAULT_VEHICLE_MODEL_ASSET } from "@/src/features/lookup/vehicle-model-assets";

type VehicleModelViewerProps = {
  minHeight?: number;
  modelSource?: ModelSource;
  modelUri?: string;
};

const VEHICLE_MODEL_HTML_OPTIONS = {
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
  posterColor: "#ffffff",
  rotationPerSecond: "26deg",
  shadowIntensity: 0.35,
} satisfies Omit<ModelViewerHtmlOptions, "modelUri">;

export function VehicleModelViewer({
  minHeight = 280,
  modelSource,
  modelUri,
}: VehicleModelViewerProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  function handleModelLoaded() {
    setModelLoaded(true);
    setErrorMessage(null);
  }

  function handleModelError(status: ModelViewerStatus) {
    setErrorMessage(status.message ?? "3D model viewer failed.");
  }

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        height: minHeight,
        minHeight,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <ModelViewerWebView
        allowsFullscreenVideo={false}
        htmlOptions={VEHICLE_MODEL_HTML_OPTIONS}
        modelSource={modelSource ?? modelUri ?? DEFAULT_VEHICLE_MODEL_ASSET.modelUri}
        onModelError={handleModelError}
        onModelLoaded={handleModelLoaded}
        onError={(event) => setErrorMessage(event.nativeEvent.description)}
        onHttpError={(event) =>
          setErrorMessage(`HTTP ${event.nativeEvent.statusCode}`)
        }
        style={{
          backgroundColor: colors.surface,
          flex: 1,
          height: minHeight,
        }}
      />
      {!modelLoaded && errorMessage ? (
        <View
          pointerEvents="none"
          style={{
            alignItems: "center",
            backgroundColor: "rgba(16, 24, 32, 0.82)",
            bottom: 0,
            justifyContent: "center",
            left: 0,
            padding: spacing.lg,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        >
          <Text
            selectable
            style={[
              typography.small,
              { color: colors.textOnDark, textAlign: "center" },
            ]}
          >
            {errorMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
