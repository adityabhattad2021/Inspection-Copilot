import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
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
  colors,
  spacing,
  typography,
} from "@/src/components/ui";
import {
  InspectionPlanCard,
  VehicleFoundLoadingState,
  VehicleIdentityPanel,
} from "@/src/features/lookup/vehicle-found-details";
import { normalizeRegistrationNumber } from "@/src/features/lookup/vehicle-found-navigation";
import { getVehicleModelAsset } from "@/src/features/lookup/vehicle-model-assets";
import { VehicleModelViewer } from "@/src/features/lookup/vehicle-model-viewer";

type VehicleFoundScreenProps = {
  registrationNumber: string;
};

export const VEHICLE_FOUND_SCREEN_LAYOUT = {
  body: "continuous-details-scroll",
  hero: "top-3d-model",
} as const;

function toUserMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Unable to prepare this vehicle.";
}

export function VehicleFoundScreen({
  registrationNumber,
}: VehicleFoundScreenProps) {
  const insets = useSafeAreaInsets();
  const [vehicle, setVehicle] = useState<VehicleProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const revealProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    async function loadVehicle() {
      setIsLoading(true);
      setErrorMessage(null);
      revealProgress.setValue(0);

      try {
        const foundVehicle = await lookupVehicle(
          normalizeRegistrationNumber(registrationNumber),
        );
        if (mounted) {
          setVehicle(foundVehicle);
          Animated.timing(revealProgress, {
            duration: 520,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }).start();
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(toUserMessage(error));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadVehicle();

    return () => {
      mounted = false;
    };
  }, [registrationNumber, revealProgress]);

  async function handleStartInspection() {
    if (!vehicle || isCreatingSession) {
      return;
    }

    setIsCreatingSession(true);
    setErrorMessage(null);
    void Haptics.selectionAsync();

    try {
      const session = await createInspectionSession(vehicle.registrationNumber);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/inspection/${session.sessionId}` as never);
    } catch (error) {
      setErrorMessage(toUserMessage(error));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsCreatingSession(false);
    }
  }

  if (isLoading) {
    return <VehicleFoundLoadingState />;
  }

  if (!vehicle) {
    return (
      <View
        style={{
          backgroundColor: colors.background,
          flex: 1,
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <Card>
          <Text selectable style={typography.title}>
            Vehicle lookup failed
          </Text>
          <Text selectable style={typography.subtitle}>
            {errorMessage ?? "No vehicle profile was returned."}
          </Text>
          <Button
            label="Try another registration"
            onPress={() => router.back()}
          />
        </Card>
      </View>
    );
  }

  const revealStyle = {
    opacity: revealProgress,
    transform: [
      {
        translateY: revealProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: revealProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };
  const modelAsset = getVehicleModelAsset(vehicle);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        flex: 1,
        paddingTop: insets.top,
      }}
    >
      <Animated.View style={revealStyle}>
        <VehicleModelViewer minHeight={360} modelUri={modelAsset.modelUri} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={{
          gap: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.xs,
        }}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.surface, flex: 1 }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={typography.eyebrow}>
            Vehicle found
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={2}
            selectable
            style={[
              typography.title,
              {
                fontSize: 30,
                lineHeight: 36,
              },
            ]}
          >
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
          <Text selectable style={typography.subtitle}>
            Copilot matched the vehicle profile and selected the inspection
            plan.
          </Text>
        </View>

        <VehicleIdentityPanel vehicle={vehicle} />

        <InspectionPlanCard vehicle={vehicle} />

        {errorMessage ? (
          <Text selectable style={[typography.small, { color: colors.danger }]}>
            {errorMessage}
          </Text>
        ) : null}

        <Button
          label="Load guided inspection"
          loading={isCreatingSession}
          onPress={handleStartInspection}
          size="lg"
        />
        <Button
          label="Change registration"
          onPress={() => router.back()}
          variant="ghost"
        />
      </ScrollView>
    </View>
  );
}
