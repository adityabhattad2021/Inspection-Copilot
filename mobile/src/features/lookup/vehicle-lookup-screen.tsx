import { ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  Card,
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

export function VehicleLookupScreen({ jockeyProfile }: VehicleLookupScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: colors.background,
        flexGrow: 1,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + spacing.sm,
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ flex: 1, gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing.sm,
              justifyContent: "space-between",
            }}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
              selectable
              style={[typography.title, { flex: 1, fontSize: 30 }]}
            >
              Hi {jockeyProfile.jockeyName},
            </Text>
            <StatusPill
              label={`${jockeyProfile.languageLabel} instructions`}
              tone="ai"
            />
          </View>
          <Text selectable style={typography.subtitle}>
            Enter the registration number to start inspection.
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: "center" }}>
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
        </View>
      </View>
    </ScrollView>
  );
}
