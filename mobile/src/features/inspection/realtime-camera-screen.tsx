import { useEffect, useRef, useState } from "react";
import {
  Animated,
  findNodeHandle,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  MediaStream,
  RTCView,
  type MediaStreamTrack,
} from "@daily-co/react-native-webrtc";

import { colors, radius, spacing, typography } from "@/src/components/ui";

type RealtimeCameraScreenProps = {
  bottomInset: number;
  captureFlash: Animated.Value;
  errorMessage: string | null;
  instruction: string;
  isBusy: boolean;
  onCapturePhoto: () => void;
  onVideoViewReady: (viewTag: number | null) => void;
  stepNumber: number;
  stepTitle: string;
  topInset: number;
  videoTrack: MediaStreamTrack | null;
};

const TOP_GLASS_CONTENT_HEIGHT = 168;
const BOTTOM_GLASS_CONTENT_HEIGHT = 252;

export function RealtimeCameraScreen({
  bottomInset,
  captureFlash,
  errorMessage,
  instruction,
  isBusy,
  onCapturePhoto,
  onVideoViewReady,
  stepNumber,
  stepTitle,
  topInset,
  videoTrack,
}: RealtimeCameraScreenProps) {
  const rtcViewRef = useRef(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!videoTrack) {
      setStream(null);
      onVideoViewReady(null);
      return;
    }

    const nextStream = new MediaStream([videoTrack]);
    setStream(nextStream);

    return () => {
      onVideoViewReady(null);
      nextStream.release(false);
    };
  }, [onVideoViewReady, videoTrack]);

  useEffect(() => {
    if (!stream) {
      return;
    }

    const timer = setTimeout(() => {
      onVideoViewReady(findNodeHandle(rtcViewRef.current));
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [onVideoViewReady, stream]);

  return (
    <View style={styles.screen}>
      {stream ? (
        <RTCView
          ref={rtcViewRef}
          mirror={false}
          objectFit="cover"
          streamURL={stream.toURL()}
          style={StyleSheet.absoluteFillObject}
        />
      ) : (
        <View style={styles.cameraFallback}>
          <Text selectable style={[typography.label, styles.fallbackText]}>
            Camera warming up
          </Text>
        </View>
      )}

      <View
        pointerEvents="none"
        style={[
          styles.scrimTop,
          { height: topInset + TOP_GLASS_CONTENT_HEIGHT },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.scrimBottom,
          { height: bottomInset + BOTTOM_GLASS_CONTENT_HEIGHT },
        ]}
      />

      <View
        style={{
          gap: spacing.sm,
          left: spacing.lg,
          position: "absolute",
          right: spacing.lg,
          top: topInset + spacing.lg,
        }}
      >
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text selectable style={[typography.small, styles.statusText]}>
              Tap capture
            </Text>
          </View>
        </View>

        <View style={styles.stepShell}>
          <Text selectable style={[typography.eyebrow, styles.stepEyebrow]}>
            Step {stepNumber}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            selectable
            style={[typography.title, styles.stepTitle]}
          >
            {stepTitle}
          </Text>
        </View>
      </View>

      <View
        style={{
          bottom: bottomInset + spacing.lg,
          gap: spacing.md,
          left: spacing.lg,
          position: "absolute",
          right: spacing.lg,
        }}
      >
        <View style={styles.instructionShell}>
          <View style={styles.instructionHeader}>
            <View style={styles.instructionAccent} />
            <Text selectable style={[typography.small, styles.instructionLabel]}>
              Saarthi says
            </Text>
          </View>
          <Text selectable style={[typography.body, styles.instructionText]}>
            {instruction}
          </Text>
          {errorMessage ? (
            <Text selectable style={[typography.small, styles.errorText]}>
              {errorMessage}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityLabel={isBusy ? "Reviewing capture" : "Capture photo"}
          accessibilityRole="button"
          disabled={isBusy || !videoTrack}
          onPress={onCapturePhoto}
          style={({ pressed }) => [
            styles.captureButton,
            (isBusy || !videoTrack) && styles.captureButtonDisabled,
            pressed && styles.captureButtonPressed,
          ]}
        >
          <View style={[styles.captureCore, isBusy && styles.captureCoreBusy]} />
        </Pressable>
      </View>

      <Animated.View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.white,
          opacity: captureFlash,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cameraFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: colors.camera,
    justifyContent: "center",
    padding: spacing.lg,
  },
  captureButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(246, 247, 242, 0.92)",
    borderColor: colors.white,
    borderRadius: radius.pill,
    borderWidth: 4,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  captureButtonDisabled: {
    opacity: 0.56,
  },
  captureButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  captureCore: {
    backgroundColor: colors.ai,
    borderRadius: radius.pill,
    height: 56,
    width: 56,
  },
  captureCoreBusy: {
    backgroundColor: colors.warningSoft,
  },
  errorText: {
    color: colors.danger,
  },
  fallbackText: {
    color: colors.textOnDark,
  },
  instructionAccent: {
    backgroundColor: colors.ai,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  instructionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  instructionLabel: {
    color: colors.aiText,
  },
  instructionShell: {
    backgroundColor: "rgba(246, 247, 242, 0.94)",
    borderColor: "rgba(215, 222, 208, 0.82)",
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  instructionText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
  },
  screen: {
    backgroundColor: colors.camera,
    flex: 1,
  },
  scrimBottom: {
    backgroundColor: "rgba(16, 24, 32, 0.22)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  scrimTop: {
    backgroundColor: "rgba(16, 24, 32, 0.2)",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  statusDot: {
    backgroundColor: colors.ai,
    borderRadius: radius.pill,
    height: 7,
    width: 7,
  },
  statusPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(246, 247, 242, 0.94)",
    borderColor: "rgba(215, 222, 208, 0.82)",
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statusText: {
    color: colors.text,
  },
  stepEyebrow: {
    color: colors.aiText,
  },
  stepShell: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(246, 247, 242, 0.94)",
    borderColor: "rgba(215, 222, 208, 0.82)",
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: "88%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
  },
});
