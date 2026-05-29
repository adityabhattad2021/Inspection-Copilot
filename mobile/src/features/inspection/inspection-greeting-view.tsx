import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "@/src/components/ui";
import { LiveWaveform } from "@/src/features/inspection/live-waveform";

type InspectionGreetingViewProps = {
  message: string;
};

export function InspectionGreetingView({ message }: InspectionGreetingViewProps) {
  const insets = useSafeAreaInsets();
  const displayMessage = message.trim();
  const hasMessage = displayMessage.length > 0;

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.background,
        flex: 1,
        justifyContent: "center",
        paddingBottom: insets.bottom + spacing.xxl,
        paddingHorizontal: spacing.xl,
        paddingTop: insets.top + spacing.xxl,
      }}
    >
      {hasMessage ? (
        <Text
          selectable
          style={{
            alignSelf: "center",
            color: colors.text,
            fontSize: 30,
            fontWeight: "800",
            letterSpacing: 0,
            lineHeight: 38,
            maxWidth: 350,
            textAlign: "left",
            width: "100%",
          }}
        >
          {displayMessage}
        </Text>
      ) : (
        <LiveWaveform
          accessibilityElementsHidden
          barColor={colors.text}
          barGap={3}
          barHeight={4}
          barRadius={40}
          barWidth={4}
          height={54}
          importantForAccessibility="no-hide-descendants"
          processing
          sensitivity={0.92}
          style={{
            maxWidth: 214,
          }}
        />
      )}
    </View>
  );
}
