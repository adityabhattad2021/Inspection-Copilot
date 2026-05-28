import { Text, View } from "react-native";

import { Button, colors, radius, spacing, typography } from "@/src/components/ui";

type EngineGuidedCheckProps = {
  isBusy: boolean;
  onSubmit: () => void;
};

const phases = ["Start engine", "Idle listen", "Gentle rev", "Exhaust listen"];

export function EngineGuidedCheck({ isBusy, onSubmit }: EngineGuidedCheckProps) {
  return (
    <View
      style={{
        backgroundColor: colors.camera,
        borderColor: "rgba(215, 248, 92, 0.18)",
        borderCurve: "continuous",
        borderRadius: radius.md,
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.md,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={[typography.eyebrow, { color: colors.ai }]}>
          Guided engine check
        </Text>
        <Text selectable style={[typography.title, { color: colors.textOnDark }]}>
          Listen, then answer
        </Text>
        <Text selectable style={[typography.subtitle, { color: colors.textOnDark }]}>
          Start the engine, listen at idle, rev gently once, and confirm knocking,
          rattling, vibration, and exhaust sound.
        </Text>
      </View>

      <View style={{ gap: spacing.xs }}>
        {phases.map((phase, index) => (
          <View
            key={phase}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: index === 0 ? colors.ai : "rgba(247, 250, 239, 0.12)",
                borderRadius: radius.pill,
                height: 26,
                justifyContent: "center",
                width: 26,
              }}
            >
              <Text
                selectable
                style={[
                  typography.small,
                  { color: index === 0 ? colors.aiText : colors.textOnDark },
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <Text selectable style={[typography.label, { color: colors.textOnDark }]}>
              {phase}
            </Text>
          </View>
        ))}
      </View>

      <Button
        label="Submit engine answer"
        loading={isBusy}
        onPress={onSubmit}
        size="lg"
      />
    </View>
  );
}
