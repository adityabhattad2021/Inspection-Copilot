import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { colors, radius, shadows, spacing } from "@/src/components/ui/theme";

type CardTone = "surface" | "muted" | "camera";

type CardProps = PropsWithChildren<{
  tone?: CardTone;
  style?: StyleProp<ViewStyle>;
}>;

const toneStyles = {
  surface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  muted: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  camera: {
    backgroundColor: colors.cameraRaised,
    borderColor: "rgba(247, 250, 239, 0.12)",
  },
} satisfies Record<CardTone, ViewStyle>;

export function Card({ children, tone = "surface", style }: CardProps) {
  return (
    <View
      style={[
        {
          borderCurve: "continuous",
          borderRadius: radius.md,
          borderWidth: 1,
          gap: spacing.md,
          padding: spacing.md,
        },
        shadows.card,
        toneStyles[tone],
        style,
      ]}
    >
      {children}
    </View>
  );
}
