import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  createInspectionSession,
  lookupVehicle,
  type VehicleProfile,
} from "@/src/api/client";
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

const DEMO_REGISTRATION_NUMBER = "KA03MX2147";

function normalizeRegistrationNumber(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

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
  const [vehicle, setVehicle] = useState<VehicleProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const normalizedRegistrationNumber =
    normalizeRegistrationNumber(registrationNumber);
  const canLookup = normalizedRegistrationNumber.length > 0 && !isLookingUp;
  const canStartInspection = vehicle !== null && !isCreatingSession;

  function handleRegistrationChange(value: string) {
    setRegistrationNumber(normalizeRegistrationNumber(value));
    setVehicle(null);
    setErrorMessage(null);
  }

  async function handleLookup() {
    if (!canLookup) {
      return;
    }

    setIsLookingUp(true);
    setErrorMessage(null);

    try {
      const foundVehicle = await lookupVehicle(normalizedRegistrationNumber);
      setVehicle(foundVehicle);
    } catch (error) {
      setVehicle(null);
      setErrorMessage(toUserMessage(error));
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleStartInspection() {
    if (!vehicle || !canStartInspection) {
      return;
    }

    setIsCreatingSession(true);
    setErrorMessage(null);

    try {
      const session = await createInspectionSession(vehicle.registrationNumber);
      router.push(`/inspection/${session.sessionId}` as never);
    } catch (error) {
      setErrorMessage(toUserMessage(error));
    } finally {
      setIsCreatingSession(false);
    }
  }

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
              label={`Your copilot will speak ${jockeyProfile.languageLabel}`}
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
                  onChangeText={handleRegistrationChange}
                  onSubmitEditing={handleLookup}
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
                  value={registrationNumber}
                />
              </View>

              {errorMessage ? (
                <Text
                  selectable
                  style={[typography.small, { color: colors.danger }]}
                >
                  {errorMessage}
                </Text>
              ) : null}

              <Button
                disabled={!canLookup}
                label="Lookup vehicle"
                loading={isLookingUp}
                onPress={handleLookup}
                size="lg"
              />
            </View>
          </Card>

          {vehicle ? (
            <VehicleResultCard
              isCreatingSession={isCreatingSession}
              onStartInspection={handleStartInspection}
              vehicle={vehicle}
            />
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

type VehicleResultCardProps = {
  isCreatingSession: boolean;
  onStartInspection: () => void;
  vehicle: VehicleProfile;
};

function VehicleResultCard({
  isCreatingSession,
  onStartInspection,
  vehicle,
}: VehicleResultCardProps) {
  return (
    <Card style={{ marginTop: spacing.md }}>
      <View
        style={{
          alignItems: "flex-start",
          flexDirection: "row",
          gap: spacing.sm,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, gap: spacing.xxs, minWidth: 0 }}>
          <Text selectable style={typography.eyebrow}>
            {vehicle.registrationNumber}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.84}
            numberOfLines={2}
            selectable
            style={typography.title}
          >
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
        </View>
        <StatusPill label="Found" tone="success" />
      </View>

      <View
        style={{
          borderTopColor: colors.border,
          borderTopWidth: 1,
          gap: spacing.sm,
          paddingTop: spacing.md,
        }}
      >
        <VehicleFact label="Variant" value={vehicle.variant} />
        <VehicleFact label="Fuel" value={vehicle.fuelType} />
        <VehicleFact label="Transmission" value={vehicle.transmission} />
        <VehicleFact
          label="Registered"
          value={`${vehicle.registrationCity}, ${vehicle.registrationState}`}
        />
      </View>

      <Button
        label="Start inspection"
        loading={isCreatingSession}
        onPress={onStartInspection}
        size="lg"
        variant="secondary"
      />
    </Card>
  );
}

type VehicleFactProps = {
  label: string;
  value: string;
};

function VehicleFact({ label, value }: VehicleFactProps) {
  return (
    <View
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: spacing.sm,
        justifyContent: "space-between",
      }}
    >
      <Text selectable style={typography.small}>
        {label}
      </Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.82}
        numberOfLines={1}
        selectable
        style={[typography.label, { flex: 1, textAlign: "right" }]}
      >
        {value}
      </Text>
    </View>
  );
}
