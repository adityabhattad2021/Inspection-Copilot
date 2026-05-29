import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Text, View, useWindowDimensions } from "react-native";
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
  radius,
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
  animationTopology: "single-shared-model-and-title",
  body: "continuous-details-scroll",
  hero: "top-3d-model",
  modelAnimation: "scroll-collapse-to-compact-preview",
  registrationPlate: "shared-ind-number-plate",
} as const;

const EXPANDED_MODEL_HEIGHT = 360;
const COMPACT_MODEL_HEIGHT = 104;
const COMPACT_MODEL_WIDTH = 112;
const COLLAPSE_DISTANCE = 380;
const HERO_TEXT_RESERVED_HEIGHT = 156;
const HERO_DETAILS_START_GAP = spacing.xxl + spacing.md;

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
  const { width } = useWindowDimensions();
  const [vehicle, setVehicle] = useState<VehicleProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const revealProgress = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    async function loadVehicle() {
      setIsLoading(true);
      setErrorMessage(null);
      revealProgress.setValue(0);
      scrollY.setValue(0);

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
  }, [registrationNumber, revealProgress, scrollY]);

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
  const modelWidth = width - spacing.md * 2;
  const compactScale = COMPACT_MODEL_HEIGHT / EXPANDED_MODEL_HEIGHT;
  const modelTranslateX = modelWidth / 2 - COMPACT_MODEL_WIDTH / 2;
  const modelTranslateY =
    -(EXPANDED_MODEL_HEIGHT - EXPANDED_MODEL_HEIGHT * compactScale) / 2;
  const sharedModelTranslateStyle = {
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [0, COLLAPSE_DISTANCE],
          outputRange: [0, modelTranslateY],
          extrapolate: "clamp",
        }),
      },
      {
        translateX: scrollY.interpolate({
          inputRange: [0, COLLAPSE_DISTANCE],
          outputRange: [0, modelTranslateX],
          extrapolate: "clamp",
        }),
      },
    ],
  };
  const sharedModelScaleStyle = {
    transform: [
      {
        scale: scrollY.interpolate({
          inputRange: [0, COLLAPSE_DISTANCE],
          outputRange: [1, compactScale],
          extrapolate: "clamp",
        }),
      },
    ],
  };
  const sharedTitleTranslateStyle = {
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [0, COLLAPSE_DISTANCE],
          outputRange: [0, -(EXPANDED_MODEL_HEIGHT + spacing.xl)],
          extrapolate: "clamp",
        }),
      },
      {
        translateX: scrollY.interpolate({
          inputRange: [0, COLLAPSE_DISTANCE],
          outputRange: [0, -spacing.xs],
          extrapolate: "clamp",
        }),
      },
    ],
  };
  const sharedTitleScaleStyle = {
    transform: [
      {
        scale: scrollY.interpolate({
          inputRange: [0, COLLAPSE_DISTANCE],
          outputRange: [1, 0.8],
          extrapolate: "clamp",
        }),
      },
    ],
  };
  const titleSubtitleStyle = {
    opacity: scrollY.interpolate({
      inputRange: [40, 220],
      outputRange: [1, 0],
      extrapolate: "clamp",
    }),
  };
  const headerBackdropStyle = {
    opacity: scrollY.interpolate({
      inputRange: [180, COLLAPSE_DISTANCE],
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        flex: 1,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            backgroundColor: colors.surface,
            height: insets.top + spacing.sm + COMPACT_MODEL_HEIGHT + spacing.sm,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 2,
          },
          headerBackdropStyle,
        ]}
      />

      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            height: EXPANDED_MODEL_HEIGHT,
            left: spacing.md,
            position: "absolute",
            right: spacing.md,
            top: insets.top + spacing.sm,
            zIndex: 3,
          },
          revealStyle,
        ]}
      >
        <Animated.View pointerEvents="box-none" style={sharedModelTranslateStyle}>
          <Animated.View pointerEvents="box-none" style={sharedModelScaleStyle}>
            <VehicleModelViewer
              minHeight={EXPANDED_MODEL_HEIGHT}
              modelUri={modelAsset.modelUri}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          {
            gap: spacing.xs,
            left: spacing.md,
            position: "absolute",
            right: COMPACT_MODEL_WIDTH + spacing.xl,
            top: insets.top + spacing.sm + EXPANDED_MODEL_HEIGHT + spacing.xs,
            zIndex: 4,
          },
          revealStyle,
        ]}
      >
        <Animated.View style={sharedTitleTranslateStyle}>
          <Animated.View style={[{ gap: spacing.xs }, sharedTitleScaleStyle]}>
            <View
              style={{
                alignSelf: "flex-start",
                backgroundColor: colors.aiSoft,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xxs,
              }}
            >
              <Text
                selectable
                style={[typography.small, { color: colors.aiText }]}
              >
                {vehicle.registrationNumber}
              </Text>
            </View>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={2}
              selectable
              style={[typography.title, { fontSize: 30, lineHeight: 36 }]}
            >
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
            <Animated.Text
              selectable
              style={[typography.subtitle, titleSubtitleStyle]}
            >
              Copilot matched the vehicle profile and selected the inspection
              plan.
            </Animated.Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{
          gap: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          paddingHorizontal: spacing.md,
          paddingTop:
            insets.top +
            spacing.sm +
            EXPANDED_MODEL_HEIGHT +
            HERO_TEXT_RESERVED_HEIGHT +
            HERO_DETAILS_START_GAP,
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: colors.surface, flex: 1 }}
      >
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
          size="lg"
          variant="ghost"
        />
      </Animated.ScrollView>
    </View>
  );
}
