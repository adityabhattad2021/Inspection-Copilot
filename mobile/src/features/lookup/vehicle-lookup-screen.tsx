import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api/client";
import {
  Button,
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/components/ui";
import {
  lookupVehicleAndBuildFoundRoute,
  normalizeRegistrationNumber,
} from "@/src/features/lookup/vehicle-found-navigation";
import type { JockeyProfile } from "@/src/features/onboarding/profile";

type VehicleLookupScreenProps = {
  jockeyProfile: JockeyProfile;
};

const DEMO_REGISTRATION_NUMBER = "KA03MX2147";
export const LOOKUP_SCREEN_LAYOUT = {
  mode: "centered-command-card",
} as const;

function toUserMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function VehicleLookupScreen({ jockeyProfile }: VehicleLookupScreenProps) {
  const insets = useSafeAreaInsets();
  const [registrationNumber, setRegistrationNumber] = useState(
    DEMO_REGISTRATION_NUMBER,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const normalizedRegistrationNumber =
    normalizeRegistrationNumber(registrationNumber);
  const canLookup = normalizedRegistrationNumber.length > 0 && !isLookingUp;

  function handleRegistrationChange(value: string) {
    setRegistrationNumber(normalizeRegistrationNumber(value));
    setErrorMessage(null);
  }

  async function handleLookup() {
    if (!canLookup) {
      return;
    }

    setIsLookingUp(true);
    setErrorMessage(null);
    void Haptics.selectionAsync();

    try {
      const route = await lookupVehicleAndBuildFoundRoute(
        normalizedRegistrationNumber,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(route as never);
    } catch (error) {
      setErrorMessage(toUserMessage(error));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLookingUp(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: colors.background,
        flexGrow: 1,
        justifyContent: "center",
        paddingBottom: insets.bottom + spacing.xxl,
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + spacing.xxl,
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderCurve: "continuous",
          borderRadius: radius.md,
          gap: spacing.xxl,
          justifyContent: "space-between",
          minHeight: 382,
          padding: spacing.lg,
          ...shadows.lift,
        }}
      >
        <View style={{ alignItems: "center", gap: spacing.xs }}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={2}
            selectable
            style={[
              typography.title,
              {
                fontSize: 28,
                lineHeight: 34,
                textAlign: "center",
              },
            ]}
          >
            Start guided inspection
          </Text>
          <Text
            selectable
            style={[typography.subtitle, { textAlign: "center" }]}
          >
            Enter the vehicle registration to identify the car and load its AI
            inspection plan.
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <View
            style={{
              gap: spacing.xs,
            }}
          >
            <Text selectable style={typography.eyebrow}>
              Hi {jockeyProfile.jockeyName} / {jockeyProfile.languageLabel}
            </Text>
            <View style={{ gap: spacing.xs }}>
              <Text selectable style={typography.label}>
                Registration command
              </Text>
              <TextInput
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={handleRegistrationChange}
                onSubmitEditing={handleLookup}
                placeholder="KA03MX2147"
                placeholderTextColor={colors.textSubtle}
                returnKeyType="done"
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderColor: isLookingUp ? colors.ai : colors.borderStrong,
                  borderCurve: "continuous",
                  borderRadius: radius.md,
                  borderWidth: 1,
                  color: colors.text,
                  fontSize: 26,
                  fontVariant: ["tabular-nums"],
                  fontWeight: "900",
                  letterSpacing: 0,
                  minHeight: 62,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                }}
                value={registrationNumber}
              />
            </View>
          </View>

          {errorMessage ? (
            <Text selectable style={[typography.small, { color: colors.danger }]}>
              {errorMessage}
            </Text>
          ) : null}
        </View>

        <Button
          disabled={!canLookup}
          label="Scan registration"
          loading={isLookingUp}
          onPress={handleLookup}
          size="lg"
        />
      </View>
    </ScrollView>
  );
}
