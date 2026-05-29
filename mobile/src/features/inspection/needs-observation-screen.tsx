import { Pressable, ScrollView, Text, View } from "react-native";

import type { InspectionStep } from "@/src/api/client";
import {
  Button,
  Card,
  ProgressRail,
  StatusPill,
  StepHeader,
  colors,
  radius,
  shadows,
  spacing,
  typography,
  type ProgressStep,
} from "@/src/components/ui";
import type { InspectionFrame } from "@/src/data/live-inspection-media";

type NeedsObservationScreenProps = {
  bottomInset: number;
  errorMessage: string | null;
  frame: InspectionFrame | null;
  isBusy: boolean;
  message: string;
  onConfirm: () => void;
  onSelectTranscript: (transcript: string) => void;
  progressSteps: readonly ProgressStep[];
  registrationNumber: string;
  step: InspectionStep;
  topInset: number;
  transcript: string;
  vehicleTitle: string;
};

const OBSERVATION_OPTIONS = [
  {
    label: "Scratch",
    transcript: "Minor scratch near the handle, no dent.",
  },
  {
    label: "Dent",
    transcript: "Minor dent near the handle.",
  },
  {
    label: "Rust",
    transcript: "Minor rust near the handle, no dent.",
  },
  {
    label: "Dirt",
    transcript: "Dirt mark near the handle, no dent.",
  },
] as const;

export function NeedsObservationScreen({
  bottomInset,
  errorMessage,
  frame,
  isBusy,
  message,
  onConfirm,
  onSelectTranscript,
  progressSteps,
  registrationNumber,
  step,
  topInset,
  transcript,
  vehicleTitle,
}: NeedsObservationScreenProps) {
  const canConfirm = transcript.trim().length > 0;

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: colors.background,
        flexGrow: 1,
        gap: spacing.lg,
        paddingBottom: bottomInset + spacing.xl,
        paddingHorizontal: spacing.lg,
        paddingTop: topInset + spacing.lg,
      }}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
    >
      <StepHeader
        description={step.section}
        eyebrow={registrationNumber}
        statusLabel="Clarify"
        statusTone="warning"
        title={vehicleTitle}
      />

      <ProgressRail steps={progressSteps} />

      <View
        style={{
          backgroundColor: colors.camera,
          borderColor: "rgba(215, 248, 92, 0.18)",
          borderCurve: "continuous",
          borderRadius: radius.md,
          borderWidth: 1,
          gap: spacing.md,
          overflow: "hidden",
          padding: spacing.md,
          ...shadows.lift,
        }}
      >
        <View
          style={{
            backgroundColor: colors.cameraRaised,
            borderColor: "rgba(247, 250, 239, 0.14)",
            borderCurve: "continuous",
            borderRadius: radius.md,
            borderWidth: 1,
            gap: spacing.md,
            minHeight: 210,
            padding: spacing.md,
          }}
        >
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text selectable style={[typography.eyebrow, { color: colors.ai }]}>
              Photo accepted
            </Text>
            <StatusPill label="Evidence" tone="success" />
          </View>

          <View
            style={{
              alignItems: "center",
              flex: 1,
              gap: spacing.sm,
              justifyContent: "center",
            }}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
              selectable
              style={[typography.title, { color: colors.textOnDark, fontSize: 26 }]}
            >
              {frame?.label ?? step.fieldName}
            </Text>
            <Text
              selectable
              style={[
                typography.subtitle,
                { color: colors.textOnDark, textAlign: "center" },
              ]}
            >
              {frame?.note ?? step.instructions}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "rgba(246, 247, 242, 0.96)",
            borderColor: "rgba(215, 222, 208, 0.86)",
            borderCurve: "continuous",
            borderRadius: radius.md,
            borderWidth: 1,
            gap: spacing.xs,
            padding: spacing.md,
          }}
        >
          <Text selectable style={[typography.small, { color: colors.aiText }]}>
            Saarthi asks
          </Text>
          <Text selectable style={[typography.body, { color: colors.text }]}>
            {message}
          </Text>
        </View>
      </View>

      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={typography.eyebrow}>
            Answer
          </Text>
          <Text selectable style={typography.title}>
            Mark type
          </Text>
          <Text selectable style={typography.subtitle}>
            {transcript ? `Heard: ${transcript}` : "Waiting for answer"}
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {OBSERVATION_OPTIONS.map((option) => {
            const isSelected = transcript === option.transcript;
            return (
              <Pressable
                accessibilityRole="button"
                key={option.label}
                onPress={() => {
                  onSelectTranscript(option.transcript);
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: isSelected ? colors.aiSoft : colors.surfaceMuted,
                    borderColor: isSelected ? colors.ai : colors.border,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    minHeight: 40,
                    opacity: pressed ? 0.72 : 1,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                  },
                ]}
              >
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  numberOfLines={1}
                  style={[
                    typography.label,
                    { color: isSelected ? colors.aiText : colors.text },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Button
          disabled={!canConfirm}
          label="Save answer"
          loading={isBusy}
          onPress={onConfirm}
          size="lg"
        />
      </Card>

      {errorMessage ? (
        <Text selectable style={[typography.small, { color: colors.danger }]}>
          {errorMessage}
        </Text>
      ) : null}
    </ScrollView>
  );
}
