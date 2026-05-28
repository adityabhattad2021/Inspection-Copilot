import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "react-native";

import {
  radius,
  spacing,
  statusTones,
  type StatusTone,
  typography,
} from "@/src/components/ui/theme";

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
  style?: StyleProp<ViewStyle>;
};

export function StatusPill({
  label,
  style,
  tone = "neutral",
}: StatusPillProps) {
  const toneStyle = statusTones[tone];

  return (
    <View
      style={[
        {
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
          borderRadius: radius.pill,
          borderWidth: 1,
          flexDirection: "row",
          gap: spacing.xs,
          minHeight: 28,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: toneStyle.dotColor,
          borderRadius: radius.pill,
          height: 7,
          width: 7,
        }}
      />
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={1}
        style={[
          typography.small,
          {
            color: toneStyle.color,
            maxWidth: 180,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
