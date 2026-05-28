import { Text, View } from "react-native";

import { colors, radius, spacing, typography } from "@/src/components/ui/theme";

export type ProgressStepStatus = "complete" | "active" | "pending" | "blocked";

export type ProgressStep = {
  id: string;
  label: string;
  status: ProgressStepStatus;
};

type ProgressRailProps = {
  steps: readonly ProgressStep[];
};

const segmentColors = {
  complete: colors.success,
  active: colors.ai,
  pending: colors.surfaceStrong,
  blocked: colors.danger,
} satisfies Record<ProgressStepStatus, string>;

const labelColors = {
  complete: colors.success,
  active: colors.aiText,
  pending: colors.textSubtle,
  blocked: colors.danger,
} satisfies Record<ProgressStepStatus, string>;

export function ProgressRail({ steps }: ProgressRailProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: "row", gap: spacing.xxs }}>
        {steps.map((step) => (
          <View
            key={step.id}
            style={{
              backgroundColor: segmentColors[step.status],
              borderCurve: "continuous",
              borderRadius: radius.pill,
              flex: 1,
              height: 6,
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {steps.map((step) => (
          <Text
            adjustsFontSizeToFit
            key={step.id}
            minimumFontScale={0.76}
            numberOfLines={1}
            style={[
              typography.small,
              {
                color: labelColors[step.status],
                flex: 1,
                minWidth: 0,
              },
            ]}
          >
            {step.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
