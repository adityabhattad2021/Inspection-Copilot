import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError } from "@/src/api/client";
import {
  Button,
  colors,
  fontFamilies,
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
import type { InspectorProfile } from "@/src/features/onboarding/profile";

type VehicleLookupScreenProps = {
  inspectorProfile: InspectorProfile;
};

const DEMO_REGISTRATION_NUMBER = "KA03MX2147";
export const LOOKUP_SCREEN_LAYOUT = {
  actionButtonSize: "lg",
  chrome: "inline-inspection-console",
  input: "ind-number-plate",
  mode: "greeting-inline-console",
} as const;

const CONSOLE_SIGNALS = [
  { label: "RC lookup", value: "ready" },
  { label: "AI plan", value: "queued" },
  { label: "voice", value: "online" },
] as const;

const DEMO_FLOW_STEPS = [
  "Profile match",
  "SUV inspection plan",
  "4-step demo route",
] as const;

function toUserMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function VehicleLookupScreen({ inspectorProfile }: VehicleLookupScreenProps) {
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
                fontFamily: fontFamilies.label,
                fontSize: 24,
                lineHeight: 30,
              },
            ]}
          >
            Hello,
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
            {inspectorProfile.inspectorName}
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
            {inspectorProfile.languageLabel} voice
          </Text>
        </View>
      </View>

      <View
        style={{
          flex: 1,
          paddingTop: spacing.lg,
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
              gap: spacing.lg,
              justifyContent: "center",
            }}
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: spacing.xs,
                justifyContent: "flex-start",
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  gap: spacing.xs,
                }}
              >
                <View
                  style={{
                    backgroundColor: colors.ai,
                    borderRadius: radius.pill,
                    height: 8,
                    width: 8,
                  }}
                />
                <Text
                  selectable
                  style={[typography.small, { color: colors.aiText }]}
                >
                  COPILOT READY
                </Text>
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                numberOfLines={2}
                selectable
                style={[
                  typography.title,
                  {
                    color: colors.text,
                    fontSize: 28,
                    lineHeight: 36,
                  },
                ]}
              >
                Scan registration
              </Text>
              <Text
                selectable
                style={[typography.subtitle, { color: colors.textMuted }]}
              >
                Vehicle profile / AI checklist / Voice route
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
                      fontFamily: fontFamilies.plate,
                      fontSize: 24,
                      fontVariant: ["tabular-nums"],
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

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
            >
              {CONSOLE_SIGNALS.map((signal) => (
                <View
                  key={signal.label}
                  style={{
                    backgroundColor: colors.aiSoft,
                    borderColor: colors.ai,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: spacing.xxs,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xxs,
                  }}
                >
                  <Text
                    selectable
                    style={[typography.small, { color: colors.aiText }]}
                  >
                    {signal.label}
                  </Text>
                  <Text
                    selectable
                    style={[typography.small, { color: colors.textMuted }]}
                  >
                    {signal.value}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={{
                gap: spacing.xs,
              }}
            >
              {DEMO_FLOW_STEPS.map((step, index) => (
                <View
                  key={step}
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: spacing.sm,
                  }}
                >
                  <Text
                    selectable
                    style={[typography.small, { color: colors.aiText }]}
                  >
                    0{index + 1}
                  </Text>
                  <View
                    style={{
                      backgroundColor: colors.ai,
                      borderRadius: radius.pill,
                      height: 5,
                      width: 5,
                    }}
                  />
                  <Text
                    selectable
                    style={[
                      typography.small,
                      { color: colors.textMuted, flex: 1 },
                    ]}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <View style={{ gap: spacing.xs }}>
          <Button
            disabled={!canLookup}
            label="Lookup vehicle"
            loading={isLookingUp}
            onPress={handleLookup}
            size={LOOKUP_SCREEN_LAYOUT.actionButtonSize}
          />
          <Button
            label="My reports"
            onPress={() => router.push("/reports" as never)}
            size={LOOKUP_SCREEN_LAYOUT.actionButtonSize}
            variant="ghost"
          />
        </View>
      </View>
    </ScrollView>
  );
}
