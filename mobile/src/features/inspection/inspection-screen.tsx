import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ApiError,
  getInspectionSession,
  type InspectionSession,
} from "@/src/api/client";
import {
  Card,
  ProgressRail,
  StepHeader,
  colors,
  spacing,
  typography,
  type ProgressStep,
} from "@/src/components/ui";

type InspectionScreenProps = {
  sessionId: string;
};

function toUserMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Unable to load this inspection session.";
}

export function InspectionScreen({ sessionId }: InspectionScreenProps) {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<InspectionSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      if (!sessionId) {
        setErrorMessage("Missing inspection session id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const loadedSession = await getInspectionSession(sessionId);
        if (mounted) {
          setSession(loadedSession);
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

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  if (isLoading) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.background,
          flex: 1,
          gap: spacing.md,
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <ActivityIndicator color={colors.camera} />
        <Text selectable style={[typography.small, { textAlign: "center" }]}>
          Preparing inspection
        </Text>
      </View>
    );
  }

  if (errorMessage || !session) {
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
            Inspection unavailable
          </Text>
          <Text selectable style={typography.subtitle}>
            {errorMessage ?? "Session was not returned by the backend."}
          </Text>
        </Card>
      </View>
    );
  }

  const vehicleTitle = `${session.vehicle.year} ${session.vehicle.make} ${session.vehicle.model}`;
  const progressSteps: ProgressStep[] = session.plan.steps.map(
    (step, index) => ({
      id: step.id,
      label: `${index + 1}`,
      status: index === 0 ? "active" : "pending",
    }),
  );
  const firstStep = session.plan.steps[0];

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: colors.background,
        flexGrow: 1,
        gap: spacing.xl,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
        paddingTop: insets.top + spacing.lg,
      }}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
    >
      <StepHeader
        description={session.plan.name}
        eyebrow={session.vehicle.registrationNumber}
        statusLabel="Session ready"
        statusTone="success"
        title={vehicleTitle}
      />

      <ProgressRail steps={progressSteps} />

      {firstStep ? (
        <Card tone="camera">
          <Text selectable style={[typography.eyebrow, { color: colors.ai }]}>
            First guided step
          </Text>
          <Text
            selectable
            style={[typography.title, { color: colors.textOnDark }]}
          >
            {firstStep.fieldName}
          </Text>
          <Text
            selectable
            style={[typography.subtitle, { color: colors.textOnDark }]}
          >
            {firstStep.instructions}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text selectable style={typography.label}>
          Inspection plan
        </Text>
        <View style={{ gap: spacing.sm }}>
          {session.plan.steps.map((step, index) => (
            <View
              key={step.id}
              style={{
                alignItems: "center",
                borderTopColor:
                  index === 0 ? colors.transparent : colors.border,
                borderTopWidth: index === 0 ? 0 : 1,
                flexDirection: "row",
                gap: spacing.sm,
                paddingTop: index === 0 ? 0 : spacing.sm,
              }}
            >
              <Text selectable style={typography.small}>
                {String(index + 1).padStart(2, "0")}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.84}
                  numberOfLines={1}
                  selectable
                  style={typography.label}
                >
                  {step.fieldName}
                </Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  numberOfLines={1}
                  selectable
                  style={typography.small}
                >
                  {step.section}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
