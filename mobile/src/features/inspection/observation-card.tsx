import { Text, View } from "react-native";

import { Button, colors, radius, spacing, typography } from "@/src/components/ui";

type ObservationCardProps = {
  isBusy: boolean;
  onAnswer: () => void;
  transcript: string;
};

export function ObservationCard({
  isBusy,
  onAnswer,
  transcript,
}: ObservationCardProps) {
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
          Voice answer
        </Text>
        <Text selectable style={[typography.title, { color: colors.textOnDark }]}>
          Is this a scratch, dent, rust, or dirt?
        </Text>
        <Text selectable style={[typography.subtitle, { color: colors.textOnDark }]}>
          Demo transcript: {transcript}
        </Text>
      </View>
      <Button
        label="Send spoken answer"
        loading={isBusy}
        onPress={onAnswer}
        size="lg"
      />
    </View>
  );
}
