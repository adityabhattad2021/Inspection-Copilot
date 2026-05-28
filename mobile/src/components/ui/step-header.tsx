import { Text, View } from "react-native";

import { StatusPill } from "@/src/components/ui/status-pill";
import {
  spacing,
  type StatusTone,
  typography,
} from "@/src/components/ui/theme";

type StepHeaderProps = {
  description?: string;
  eyebrow: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  title: string;
};

export function StepHeader({
  description,
  eyebrow,
  statusLabel,
  statusTone = "neutral",
  title,
}: StepHeaderProps) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{
          alignItems: "flex-start",
          flexDirection: "row",
          gap: spacing.sm,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, gap: spacing.xxs, minWidth: 0 }}>
          <Text selectable style={typography.eyebrow}>
            {eyebrow}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.84}
            numberOfLines={2}
            selectable
            style={typography.title}
          >
            {title}
          </Text>
        </View>
        {statusLabel ? (
          <StatusPill label={statusLabel} tone={statusTone} />
        ) : null}
      </View>
      {description ? (
        <Text selectable style={typography.subtitle}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}
