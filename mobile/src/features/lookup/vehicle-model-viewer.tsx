import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import { WebView } from "react-native-webview";

import { colors, spacing, typography } from "@/src/components/ui";
import { getVehicleModelViewerHtml } from "@/src/features/lookup/vehicle-model-html";

type VehicleModelViewerProps = {
  minHeight?: number;
  modelUri?: string;
};

export function VehicleModelViewer({
  minHeight = 280,
  modelUri,
}: VehicleModelViewerProps) {
  const viewerHtml = useMemo(
    () => getVehicleModelViewerHtml(modelUri),
    [modelUri],
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  function handleViewerMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        message?: string;
        type?: string;
      };

      if (payload.type === "model-loaded") {
        setModelLoaded(true);
        setErrorMessage(null);
        return;
      }

      if (payload.type?.endsWith("error")) {
        setErrorMessage(payload.message ?? "3D model viewer failed.");
      }
    } catch {
      setErrorMessage(event.nativeEvent.data);
    }
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
      <WebView
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        allowsFullscreenVideo={false}
        androidLayerType="hardware"
        bounces={false}
        domStorageEnabled
        javaScriptEnabled
        mixedContentMode="always"
        onError={(event) => setErrorMessage(event.nativeEvent.description)}
        onHttpError={(event) =>
          setErrorMessage(`HTTP ${event.nativeEvent.statusCode}`)
        }
        onMessage={handleViewerMessage}
        originWhitelist={["*"]}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        source={{
          baseUrl: "https://localhost/",
          html: viewerHtml,
        }}
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
