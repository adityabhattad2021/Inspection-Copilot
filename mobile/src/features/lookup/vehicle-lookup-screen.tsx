import { ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  Card,
  ProgressRail,
  StatusPill,
  colors,
  radius,
  spacing,
  typography,
} from "@/src/components/ui";
import type { JockeyProfile } from "@/src/features/onboarding/profile";

type VehicleLookupScreenProps = {
  jockeyProfile: JockeyProfile;
};

const demoSteps = [
  { id: "front", label: "Front", status: "pending" as const },
  { id: "rear", label: "Rear", status: "pending" as const },
  { id: "door", label: "Door", status: "pending" as const },
  { id: "dash", label: "Dash", status: "pending" as const },
  { id: "engine", label: "Engine", status: "pending" as const },
];

export function VehicleLookupScreen({ jockeyProfile }: VehicleLookupScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: colors.background,
        flexGrow: 1,
        gap: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.md,
        paddingTop: insets.top + spacing.xl,
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ gap: spacing.sm }}>
        <StatusPill
          label={`${jockeyProfile.languageLabel} instructions`}
          tone="ai"
        />
        <Text selectable style={[typography.title, { fontSize: 28 }]}>
          Hi {jockeyProfile.jockeyName}
        </Text>
        <Text selectable style={typography.subtitle}>
          Start with vehicle lookup, then Copilot will guide each inspection
          angle.
        </Text>
      </View>

      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text selectable style={typography.label}>
              Registration number
            </Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              defaultValue="KA03MX2147"
              placeholder="KA03MX2147"
              placeholderTextColor={colors.textSubtle}
              returnKeyType="done"
              style={{
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                borderCurve: "continuous",
                borderRadius: radius.md,
                borderWidth: 1,
                color: colors.text,
                fontSize: 20,
                fontVariant: ["tabular-nums"],
                fontWeight: "800",
                letterSpacing: 0,
                minHeight: 56,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            />
          </View>

          <Button label="Lookup vehicle" onPress={() => {}} size="lg" />
        </View>
      </Card>

      <Card tone="muted">
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text selectable style={typography.label}>
              Demo inspection plan
            </Text>
            <StatusPill label="5 steps" tone="neutral" />
          </View>
          <ProgressRail steps={demoSteps} />
        </View>
      </Card>
    </ScrollView>
  );
}
