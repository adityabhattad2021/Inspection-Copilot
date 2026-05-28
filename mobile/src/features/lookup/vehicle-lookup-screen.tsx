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
  spacing,
  typography,
} from "@/src/components/ui";
import {
  lookupVehicleAndBuildFoundRoute,
  normalizeRegistrationNumber,
} from "@/src/features/lookup/vehicle-found-navigation";
import {
  formatRegistrationPlate,
  RegistrationPlateShell,
} from "@/src/features/lookup/registration-plate";
import type { JockeyProfile } from "@/src/features/onboarding/profile";

type VehicleLookupScreenProps = {
  jockeyProfile: JockeyProfile;
};

const DEMO_REGISTRATION_NUMBER = "KA03MX2147";
export const LOOKUP_SCREEN_LAYOUT = {
  input: "ind-number-plate",
  mode: "greeting-centered-plate-inline",
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
  const formattedRegistrationNumber = formatRegistrationPlate(
    registrationNumber,
  );
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
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + spacing.xl,
      }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: colors.background }}
    >
      <View
        style={{
          alignItems: "flex-start",
          flexDirection: "row",
          gap: spacing.md,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={1}
            selectable
            style={[
              typography.title,
              {
                color: colors.textMuted,
                fontSize: 24,
                fontWeight: "700",
                lineHeight: 30,
              },
          ]}
        >
            Hello
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.78}
            numberOfLines={1}
            selectable
            style={[
              typography.title,
              {
                fontSize: 34,
                lineHeight: 40,
              },
            ]}
          >
            {jockeyProfile.jockeyName}
          </Text>
        </View>
        <View
          style={{
            alignItems: "center",
            alignSelf: "flex-start",
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderCurve: "continuous",
            borderRadius: radius.pill,
            borderWidth: 1,
            flexDirection: "row",
            gap: spacing.xs,
            marginTop: spacing.sm,
            maxWidth: 142,
            minHeight: 36,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
          }}
        >
          <View
            style={{
              backgroundColor: colors.ai,
              borderRadius: radius.pill,
              height: 7,
              width: 7,
            }}
          />
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.76}
            numberOfLines={1}
            selectable
            style={[
              typography.small,
              {
                color: colors.text,
                flexShrink: 1,
              },
            ]}
          >
            {jockeyProfile.languageLabel} voice
          </Text>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          paddingTop: spacing.xl,
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              gap: spacing.xxl + spacing.xs,
              justifyContent: "center",
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                numberOfLines={2}
                selectable
                style={[
                  typography.title,
                  {
                    fontSize: 28,
                    lineHeight: 36,
                  },
                ]}
              >
                Enter the Registration Number
              </Text>
            </View>

            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.sm }}>
                <RegistrationPlateShell>
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    onChangeText={handleRegistrationChange}
                    onSubmitEditing={handleLookup}
                    placeholder="KA 03 MX 2147"
                    placeholderTextColor={colors.textSubtle}
                    returnKeyType="done"
                    style={{
                      backgroundColor: colors.white,
                      color: colors.text,
                      flex: 1,
                      fontSize: 24,
                      fontVariant: ["tabular-nums"],
                      fontWeight: "900",
                      letterSpacing: 0,
                      minHeight: 70,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                      textAlign: "center",
                    }}
                    value={formattedRegistrationNumber}
                  />
                </RegistrationPlateShell>
                {isLookingUp ? (
                  <Text
                    selectable
                    style={[typography.small, { color: colors.aiText }]}
                  >
                    Matching vehicle profile...
                  </Text>
                ) : null}
              </View>

              {errorMessage ? (
                <Text
                  selectable
                  style={[typography.small, { color: colors.danger }]}
                >
                  {errorMessage}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <Button
          disabled={!canLookup}
          label="Lookup vehicle"
          loading={isLookingUp}
          onPress={handleLookup}
          size="lg"
        />
      </View>
    </ScrollView>
  );
}
