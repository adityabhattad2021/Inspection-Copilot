import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, colors, radius, spacing, typography } from "@/src/components/ui";

export type EngineQnaAnswers = {
  exhaustSound: string;
  idleVibration: string;
  knocking: string;
  rattling: string;
};

type EngineGuidedCheckProps = {
  isBusy: boolean;
  onSubmit: (answers: EngineQnaAnswers) => void;
};

type EngineQuestionId = keyof EngineQnaAnswers;

type EngineQuestion = {
  id: EngineQuestionId;
  instruction: string;
  options: {
    label: string;
    value: string;
  }[];
  prompt: string;
};

const checkSteps = [
  "Start engine",
  "Let it idle",
  "Rev gently once",
  "Check exhaust",
];

const engineQuestions: EngineQuestion[] = [
  {
    id: "knocking",
    instruction: "Listen near the bonnet during idle and gentle rev.",
    options: [
      { label: "No knock", value: "no" },
      { label: "Knock heard", value: "yes" },
    ],
    prompt: "Knocking sound",
  },
  {
    id: "rattling",
    instruction: "Listen for loose metallic rattle from the engine bay.",
    options: [
      { label: "No rattle", value: "no" },
      { label: "Rattle heard", value: "yes" },
    ],
    prompt: "Rattling sound",
  },
  {
    id: "idleVibration",
    instruction: "Watch the cabin and steering at idle.",
    options: [
      { label: "None", value: "none" },
      { label: "Mild", value: "mild" },
      { label: "Heavy", value: "heavy" },
    ],
    prompt: "Idle vibration",
  },
  {
    id: "exhaustSound",
    instruction: "Stand near the rear and listen for uneven exhaust note.",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Noisy", value: "noisy" },
      { label: "Smoke/noise", value: "smoke" },
    ],
    prompt: "Exhaust sound",
  },
];

export function EngineGuidedCheck({ isBusy, onSubmit }: EngineGuidedCheckProps) {
  const [answers, setAnswers] = useState<Partial<EngineQnaAnswers>>({});
  const answeredCount = Object.keys(answers).length;
  const isComplete = answeredCount === engineQuestions.length;
  const completedAnswers = useMemo(
    () => (isComplete ? (answers as EngineQnaAnswers) : null),
    [answers, isComplete],
  );

  function selectAnswer(id: EngineQuestionId, value: string) {
    setAnswers((current) => ({
      ...current,
      [id]: value,
    }));
  }

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text selectable style={[typography.eyebrow, { color: colors.ai }]}>
          Engine Q&A
        </Text>
        <Text selectable style={[typography.title, { color: colors.textOnDark }]}>
          Listen, answer, submit
        </Text>
        <Text selectable style={[typography.subtitle, { color: colors.textOnDark }]}>
          Start the engine, let it idle, rev gently once, then tap options or answer aloud.
        </Text>
      </View>

      <View style={styles.stepGrid}>
        {checkSteps.map((phase, index) => (
          <View key={phase} style={styles.stepItem}>
            <View style={[styles.stepNumber, index === 0 && styles.stepNumberActive]}>
              <Text
                selectable
                style={[
                  typography.small,
                  { color: index === 0 ? colors.aiText : colors.textOnDark },
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              numberOfLines={1}
              selectable
              style={[typography.label, { color: colors.textOnDark }]}
            >
              {phase}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.questionList}>
        {engineQuestions.map((question) => {
          const selectedValue = answers[question.id];
          return (
            <View key={question.id} style={styles.questionBlock}>
              <View style={styles.questionCopy}>
                <Text selectable style={[typography.label, styles.questionTitle]}>
                  {question.prompt}
                </Text>
                <Text selectable style={[typography.small, styles.questionInstruction]}>
                  {question.instruction}
                </Text>
              </View>

              <View style={styles.optionRow}>
                {question.options.map((option) => {
                  const isSelected = selectedValue === option.value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={option.value}
                      onPress={() => {
                        selectAnswer(question.id, option.value);
                      }}
                      style={({ pressed }) => [
                        styles.optionChip,
                        isSelected && styles.optionChipSelected,
                        pressed && styles.optionChipPressed,
                      ]}
                    >
                      <Text
                        adjustsFontSizeToFit
                        minimumFontScale={0.82}
                        numberOfLines={1}
                        selectable
                        style={[
                          typography.small,
                          styles.optionText,
                          isSelected && styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      <Button
        disabled={!completedAnswers}
        label={`Submit engine Q&A (${answeredCount}/${engineQuestions.length})`}
        loading={isBusy}
        onPress={() => {
          if (completedAnswers) {
            onSubmit(completedAnswers);
          }
        }}
        size="lg"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  optionChip: {
    alignItems: "center",
    backgroundColor: "rgba(247, 250, 239, 0.1)",
    borderColor: "rgba(247, 250, 239, 0.16)",
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 42,
    minWidth: 92,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  optionChipPressed: {
    transform: [{ scale: 0.98 }],
  },
  optionChipSelected: {
    backgroundColor: colors.ai,
    borderColor: colors.ai,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  optionText: {
    color: colors.textOnDark,
    textAlign: "center",
  },
  optionTextSelected: {
    color: colors.aiText,
  },
  questionBlock: {
    backgroundColor: "rgba(247, 250, 239, 0.07)",
    borderColor: "rgba(247, 250, 239, 0.12)",
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  questionCopy: {
    gap: spacing.xxs,
  },
  questionInstruction: {
    color: "rgba(247, 250, 239, 0.72)",
  },
  questionList: {
    gap: spacing.sm,
  },
  questionTitle: {
    color: colors.textOnDark,
  },
  shell: {
    backgroundColor: colors.camera,
    borderColor: "rgba(215, 248, 92, 0.18)",
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  stepGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  stepItem: {
    alignItems: "center",
    backgroundColor: "rgba(247, 250, 239, 0.08)",
    borderColor: "rgba(247, 250, 239, 0.12)",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  stepNumber: {
    alignItems: "center",
    backgroundColor: "rgba(247, 250, 239, 0.12)",
    borderRadius: radius.pill,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  stepNumberActive: {
    backgroundColor: colors.ai,
  },
});
