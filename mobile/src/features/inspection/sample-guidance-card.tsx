import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import type { LiveFrameAnalysis } from "@/src/api/client";
import {
  Button,
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/components/ui";
import type { SampleFrame } from "@/src/data/sample-media";

type SampleGuidanceCardProps = {
  analysis: LiveFrameAnalysis | null;
  captureFlash: Animated.Value;
  expectedParts: readonly string[];
  frame: SampleFrame;
  isBusy: boolean;
  onAnalyze: () => void;
  onUseNextFrame: () => void;
};

const toneStyles = {
  clear: {
    backgroundColor: "#F9FBF2",
    borderColor: "rgba(17, 132, 91, 0.38)",
  },
  dark: {
    backgroundColor: "#161A18",
    borderColor: "rgba(247, 250, 239, 0.2)",
  },
  issue: {
    backgroundColor: "#FFF8E5",
    borderColor: "rgba(183, 121, 31, 0.44)",
  },
  wide: {
    backgroundColor: "#F5F6EE",
    borderColor: "rgba(199, 61, 61, 0.34)",
  },
} satisfies Record<SampleFrame["tone"], { backgroundColor: string; borderColor: string }>;

export function SampleGuidanceCard({
  analysis,
  captureFlash,
  expectedParts,
  frame,
  isBusy,
  onAnalyze,
  onUseNextFrame,
}: SampleGuidanceCardProps) {
  const isDark = frame.tone === "dark";
  const frameColor = isDark ? colors.textOnDark : colors.text;
  const canApplyGuidance = analysis?.status === "adjust";

  return (
    <View
      style={{
        backgroundColor: colors.camera,
        borderColor: "rgba(215, 248, 92, 0.18)",
        borderCurve: "continuous",
        borderRadius: radius.md,
        borderWidth: 1,
        gap: spacing.md,
        overflow: "hidden",
        padding: spacing.md,
        ...shadows.lift,
      }}
    >
      <View
        style={[
          {
            borderCurve: "continuous",
            borderRadius: radius.md,
            borderWidth: 1,
            minHeight: 260,
            overflow: "hidden",
            padding: spacing.md,
          },
          toneStyles[frame.tone],
        ]}
      >
        <View
          style={{
            alignItems: "center",
            flex: 1,
            gap: spacing.md,
            justifyContent: "center",
            minHeight: 220,
          }}
        >
          <Text
            selectable
            style={[
              typography.eyebrow,
              { color: isDark ? colors.ai : colors.textMuted },
            ]}
          >
            Sample frame
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            selectable
            style={[typography.title, { color: frameColor, fontSize: 28 }]}
          >
            {frame.label}
          </Text>
          <Text
            selectable
            style={[
              typography.subtitle,
              {
                color: isDark ? colors.textOnDark : colors.textMuted,
                textAlign: "center",
              },
            ]}
          >
            {frame.note}
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing.xs,
              justifyContent: "center",
            }}
          >
            {expectedParts.map((part) => (
              <View
                key={part}
                style={{
                  backgroundColor: isDark ? "rgba(215, 248, 92, 0.12)" : colors.surface,
                  borderColor: isDark ? "rgba(215, 248, 92, 0.28)" : colors.border,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xxs,
                }}
              >
                <Text
                  selectable
                  style={[
                    typography.small,
                    { color: isDark ? colors.textOnDark : colors.textMuted },
                  ]}
                >
                  {part}
                </Text>
              </View>
            ))}
          </View>
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

      {analysis ? (
        <View
          style={{
            backgroundColor:
              analysis.status === "hold" ? colors.aiSoft : colors.warningSoft,
            borderColor: analysis.status === "hold" ? colors.ai : colors.warning,
            borderCurve: "continuous",
            borderRadius: radius.md,
            borderWidth: 1,
            gap: spacing.xs,
            padding: spacing.md,
          }}
        >
          <Text selectable style={[typography.label, { color: colors.aiText }]}>
            Copilot
          </Text>
          <Text selectable style={[typography.body, { color: colors.aiText }]}>
            {analysis.guidance}
          </Text>
          <Text selectable style={[typography.small, { color: colors.aiText }]}>
            Confidence {Math.round(analysis.confidence * 100)}%
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button
          disabled={isBusy}
          label={analysis ? "Check again" : "Ask copilot"}
          loading={isBusy}
          onPress={onAnalyze}
          style={{ flex: 1 }}
        />
        {canApplyGuidance ? (
          <Pressable
            accessibilityRole="button"
            onPress={onUseNextFrame}
            style={({ pressed }) => [
              {
                alignItems: "center",
                borderColor: colors.border,
                borderRadius: radius.md,
                borderWidth: 1,
                flex: 1,
                justifyContent: "center",
                minHeight: 48,
                opacity: pressed ? 0.72 : 1,
                padding: spacing.sm,
              },
            ]}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
              style={[typography.label, { color: colors.textOnDark }]}
            >
              Apply guidance
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
