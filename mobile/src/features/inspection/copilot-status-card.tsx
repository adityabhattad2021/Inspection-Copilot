import { Text, View } from "react-native";

import {
  Card,
  StatusPill,
  colors,
  spacing,
  typography,
} from "@/src/components/ui";
import { PIPECAT_VOICE_BOUNDARY } from "@/src/features/inspection/pipecat-voice-boundary";

type CopilotStatusCardProps = {
  message: string;
};

export function CopilotStatusCard({ message }: CopilotStatusCardProps) {
  return (
    <Card style={{ gap: spacing.sm }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text selectable style={typography.label}>
          Copilot voice
        </Text>
        <StatusPill label={PIPECAT_VOICE_BOUNDARY.provider} tone="ai" />
      </View>
      <Text selectable style={typography.subtitle}>
        {message}
      </Text>
      <Text selectable style={[typography.small, { color: colors.textMuted }]}>
        Transport: {PIPECAT_VOICE_BOUNDARY.transport}
      </Text>
    </Card>
  );
}
