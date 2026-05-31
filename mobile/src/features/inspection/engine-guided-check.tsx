import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, colors, radius, spacing, typography } from "@/src/components/ui";

export type EngineQnaAnswers = {
  exhaustSound: string;
  idleVibration: string;
  knocking: string;
  rattling: string;
};

export type EngineGuidedPhaseId = "prep" | "idle" | "rev" | "exhaust";

type EngineGuidedMode = "instruction" | "question" | "review";

type EngineAnswerValue =
  | "both"
  | "heavy"
  | "knocking"
  | "mild"
  | "no"
  | "noisy"
  | "none"
  | "normal"
  | "rattling"
  | "smoke";

type EngineQuestionOption = {
  label: string;
  value: EngineAnswerValue;
};

type EngineGuidedPhase = {
  id: EngineGuidedPhaseId;
  instruction: string;
  options?: readonly EngineQuestionOption[];
  question?: string;
  readyLabel: string;
  title: string;
};

export type EngineGuidedState = {
  answers: EngineQnaAnswers;
  mode: EngineGuidedMode;
  phaseIndex: number;
};

const EMPTY_ENGINE_ANSWERS: EngineQnaAnswers = {
  exhaustSound: "",
  idleVibration: "",
  knocking: "",
  rattling: "",
};

export const ENGINE_SCREEN_COPY = {
  eyebrow: "Engine check",
  reviewLabel: "Engine findings",
  subtitle: "Run the physical engine checks first. Record each answer after.",
  title: "Engine inspection",
} as const;

export const ENGINE_CHECK_PHASES: readonly EngineGuidedPhase[] = [
  {
    id: "prep",
    instruction:
      "Park in P or neutral, keep the handbrake on, open the bonnet, then start the engine.",
    readyLabel: "Engine ready",
    title: "Engine start",
  },
  {
    id: "idle",
    instruction: "Stand near the bonnet and listen for 10 seconds while the engine idles.",
    options: [
      { label: "No abnormal sound", value: "no" },
      { label: "Knock heard", value: "knocking" },
      { label: "Rattle heard", value: "rattling" },
      { label: "Both heard", value: "both" },
    ],
    question: "Did you hear knocking or metallic rattling?",
    readyLabel: "Idle checked",
    title: "Bonnet idle",
  },
  {
    id: "rev",
    instruction: "Ask for one gentle rev, release, and watch the engine settle back to idle.",
    options: [
      { label: "Smooth", value: "none" },
      { label: "Mild vibration", value: "mild" },
      { label: "Heavy vibration", value: "heavy" },
    ],
    question: "What changed during the rev and return to idle?",
    readyLabel: "Rev checked",
    title: "Rev response",
  },
  {
    id: "exhaust",
    instruction: "Stand near the rear and listen to the exhaust note for 5 seconds.",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Noisy", value: "noisy" },
      { label: "Smoke/noise", value: "smoke" },
    ],
    question: "How does the exhaust sound?",
    readyLabel: "Exhaust checked",
    title: "Exhaust note",
  },
] as const;

type EngineGuidedCheckProps = {
  isBusy: boolean;
  onSubmit: (answers: EngineQnaAnswers) => void;
};

export function createInitialEngineGuidedState(): EngineGuidedState {
  return {
    answers: EMPTY_ENGINE_ANSWERS,
    mode: "instruction",
    phaseIndex: 0,
  };
}

export function getCurrentEnginePhase(state: EngineGuidedState) {
  return ENGINE_CHECK_PHASES[state.phaseIndex] ?? ENGINE_CHECK_PHASES[0];
}

export function getEngineAnswerTranscript(answers: EngineQnaAnswers) {
  return [
    `Knocking: ${answers.knocking}.`,
    `Rattling: ${answers.rattling}.`,
    `Idle vibration: ${answers.idleVibration}.`,
    `Exhaust sound: ${answers.exhaustSound}.`,
  ].join(" ");
}

export function recordEngineQuestionAnswer(
  state: EngineGuidedState,
  value: EngineAnswerValue,
): EngineGuidedState {
  const phase = getCurrentEnginePhase(state);
  const answers = { ...state.answers };

  if (phase.id === "idle") {
    answers.knocking = value === "knocking" || value === "both" ? "yes" : "no";
    answers.rattling = value === "rattling" || value === "both" ? "yes" : "no";
  }

  if (phase.id === "rev") {
    answers.idleVibration = value;
  }

  if (phase.id === "exhaust") {
    answers.exhaustSound = value;
  }

  return {
    ...state,
    answers,
  };
}

export function advanceEngineGuidedState(
  state: EngineGuidedState,
): EngineGuidedState {
  const phase = getCurrentEnginePhase(state);
  const isLastPhase = state.phaseIndex === ENGINE_CHECK_PHASES.length - 1;

  if (state.mode === "instruction") {
    if (phase.question) {
      return {
        ...state,
        mode: "question",
      };
    }

    return {
      ...state,
      phaseIndex: Math.min(state.phaseIndex + 1, ENGINE_CHECK_PHASES.length - 1),
    };
  }

  if (state.mode === "question") {
    if (isLastPhase) {
      return {
        ...state,
        mode: "review",
      };
    }

    return {
      ...state,
      mode: "instruction",
      phaseIndex: state.phaseIndex + 1,
    };
  }

  return state;
}

function getEnginePhaseAnswerValue(state: EngineGuidedState): string {
  const phase = getCurrentEnginePhase(state);

  if (phase.id === "idle") {
    if (state.answers.knocking === "yes" && state.answers.rattling === "yes") {
      return "both";
    }
    if (state.answers.knocking === "yes") {
      return "knocking";
    }
    if (state.answers.rattling === "yes") {
      return "rattling";
    }
    if (state.answers.knocking === "no" && state.answers.rattling === "no") {
      return "no";
    }
  }

  if (phase.id === "rev") {
    return state.answers.idleVibration;
  }

  if (phase.id === "exhaust") {
    return state.answers.exhaustSound;
  }

  return "";
}

function isEngineGuidedStateComplete(state: EngineGuidedState) {
  return (
    state.mode === "review" &&
    Boolean(state.answers.knocking) &&
    Boolean(state.answers.rattling) &&
    Boolean(state.answers.idleVibration) &&
    Boolean(state.answers.exhaustSound)
  );
}

function getPhaseStatus(state: EngineGuidedState, phaseIndex: number) {
  if (phaseIndex < state.phaseIndex || state.mode === "review") {
    return "complete";
  }
  if (phaseIndex === state.phaseIndex) {
    return "active";
  }
  return "pending";
}

function getAnswerSummary(answers: EngineQnaAnswers) {
  return [
    {
      label: "Knocking",
      value: answers.knocking || "pending",
    },
    {
      label: "Rattling",
      value: answers.rattling || "pending",
    },
    {
      label: "Idle vibration",
      value: answers.idleVibration || "pending",
    },
    {
      label: "Exhaust",
      value: answers.exhaustSound || "pending",
    },
  ];
}

export function EngineGuidedCheck({ isBusy, onSubmit }: EngineGuidedCheckProps) {
  const [state, setState] = useState(createInitialEngineGuidedState);
  const phase = getCurrentEnginePhase(state);
  const selectedAnswer = getEnginePhaseAnswerValue(state);
  const isComplete = isEngineGuidedStateComplete(state);
  const answerSummary = useMemo(
    () => getAnswerSummary(state.answers),
    [state.answers],
  );
  const completedCount = answerSummary.filter(
    (item) => item.value !== "pending",
  ).length;

  function handleAdvance() {
    setState((current) => advanceEngineGuidedState(current));
  }

  function handleSelectAnswer(value: EngineAnswerValue) {
    setState((current) => recordEngineQuestionAnswer(current, value));
  }

  const primaryLabel =
    state.mode === "review"
      ? "Submit engine Q&A"
      : state.mode === "question"
        ? phase.id === "exhaust"
          ? "Review engine answers"
          : "Continue"
        : phase.readyLabel;
  const canAdvance =
    state.mode === "instruction" ||
    state.mode === "review" ||
    Boolean(selectedAnswer);

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Text selectable style={[typography.eyebrow, styles.eyebrow]}>
          {ENGINE_SCREEN_COPY.eyebrow}
        </Text>
        <Text selectable style={[typography.title, styles.title]}>
          {ENGINE_SCREEN_COPY.title}
        </Text>
        <Text selectable style={[typography.subtitle, styles.subtitle]}>
          {state.mode === "review"
            ? "Engine responses are ready for pricing and audit."
            : ENGINE_SCREEN_COPY.subtitle}
        </Text>
      </View>

      <View style={styles.enginePanel}>
        <View style={styles.engineStatusMark}>
          <View style={styles.engineStatusDot} />
        </View>
        <View style={styles.enginePanelCopy}>
          <Text selectable style={[typography.label, styles.enginePanelTitle]}>
            Live engine checklist
          </Text>
          <Text selectable style={[typography.small, styles.enginePanelText]}>
            Bonnet idle, gentle rev, exhaust note
          </Text>
        </View>
        <View style={styles.engineCounter}>
          <Text selectable style={[typography.small, styles.engineCounterText]}>
            {completedCount}/4
          </Text>
        </View>
      </View>

      <View style={styles.phaseRail}>
        {ENGINE_CHECK_PHASES.map((item, index) => {
          const status = getPhaseStatus(state, index);
          return (
            <View
              key={item.id}
              style={[
                styles.phasePill,
                status === "active" && styles.phasePillActive,
                status === "complete" && styles.phasePillComplete,
              ]}
            >
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.76}
                numberOfLines={1}
                selectable
                style={[
                  typography.small,
                  styles.phaseText,
                  status !== "pending" && styles.phaseTextActive,
                  status === "complete" && styles.phaseTextComplete,
                ]}
              >
                {index + 1}. {item.title}
              </Text>
            </View>
          );
        })}
      </View>

      {state.mode === "review" ? (
        <View style={styles.reviewCard}>
          <Text selectable style={[typography.label, styles.cardLabel]}>
            {ENGINE_SCREEN_COPY.reviewLabel}
          </Text>
          <View style={styles.summaryGrid}>
            {answerSummary.map((item) => (
              <View key={item.label} style={styles.summaryItem}>
                <Text selectable style={[typography.small, styles.summaryLabel]}>
                  {item.label}
                </Text>
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                  numberOfLines={1}
                  selectable
                  style={[typography.label, styles.summaryValue]}
                >
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.activeCard}>
          <View style={styles.cardHeader}>
            <Text selectable style={[typography.label, styles.cardLabel]}>
              {state.mode === "question"
                ? "Engine observation"
                : "Physical engine check"}
            </Text>
            <View style={styles.modePill}>
              <Text selectable style={[typography.small, styles.modePillText]}>
                {state.mode === "question" ? "Q&A" : "Check"}
              </Text>
            </View>
          </View>

          <Text selectable style={[typography.title, styles.phaseTitle]}>
            {phase.title}
          </Text>
          <Text selectable style={[typography.body, styles.promptText]}>
            {state.mode === "question" ? phase.question : phase.instruction}
          </Text>

          {state.mode === "question" && phase.options ? (
            <View style={styles.optionGrid}>
              {phase.options.map((option) => {
                const isSelected = selectedAnswer === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option.value}
                    onPress={() => {
                      handleSelectAnswer(option.value);
                    }}
                    style={({ pressed }) => [
                      styles.optionChip,
                      isSelected && styles.optionChipSelected,
                      pressed && styles.optionChipPressed,
                    ]}
                  >
                    <Text
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
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
          ) : null}
        </View>
      )}

      <Button
        disabled={!canAdvance || (state.mode === "review" && !isComplete)}
        label={primaryLabel}
        loading={isBusy}
        onPress={() => {
          if (state.mode === "review") {
            onSubmit(state.answers);
            return;
          }
          handleAdvance();
        }}
        size="lg"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    backgroundColor: "rgba(247, 250, 239, 0.07)",
    borderColor: "rgba(247, 250, 239, 0.12)",
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardLabel: {
    color: colors.ai,
  },
  eyebrow: {
    color: colors.ai,
  },
  engineCounter: {
    alignItems: "center",
    backgroundColor: "rgba(215, 248, 92, 0.13)",
    borderColor: "rgba(215, 248, 92, 0.28)",
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  engineCounterText: {
    color: colors.textOnDark,
    fontVariant: ["tabular-nums"],
  },
  engineStatusDot: {
    backgroundColor: colors.ai,
    borderRadius: radius.pill,
    height: 10,
    width: 10,
  },
  engineStatusMark: {
    alignItems: "center",
    backgroundColor: "rgba(215, 248, 92, 0.12)",
    borderColor: "rgba(215, 248, 92, 0.26)",
    borderCurve: "continuous",
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  enginePanel: {
    alignItems: "center",
    backgroundColor: "rgba(247, 250, 239, 0.07)",
    borderColor: "rgba(247, 250, 239, 0.12)",
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  enginePanelCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  enginePanelText: {
    color: "rgba(247, 250, 239, 0.68)",
  },
  enginePanelTitle: {
    color: colors.textOnDark,
  },
  header: {
    gap: spacing.xs,
  },
  modePill: {
    backgroundColor: "rgba(215, 248, 92, 0.13)",
    borderColor: "rgba(215, 248, 92, 0.28)",
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  modePillText: {
    color: colors.textOnDark,
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
    minWidth: 116,
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
  optionGrid: {
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
  phasePill: {
    alignItems: "center",
    backgroundColor: "rgba(247, 250, 239, 0.08)",
    borderColor: "rgba(247, 250, 239, 0.12)",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexGrow: 1,
    minHeight: 36,
    minWidth: 128,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  phasePillActive: {
    backgroundColor: "rgba(215, 248, 92, 0.14)",
    borderColor: "rgba(215, 248, 92, 0.38)",
  },
  phasePillComplete: {
    backgroundColor: colors.ai,
    borderColor: colors.ai,
  },
  phaseRail: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  phaseText: {
    color: "rgba(247, 250, 239, 0.62)",
    textAlign: "center",
  },
  phaseTextActive: {
    color: colors.textOnDark,
  },
  phaseTextComplete: {
    color: colors.aiText,
  },
  phaseTitle: {
    color: colors.textOnDark,
    fontSize: 22,
    lineHeight: 28,
  },
  promptText: {
    color: colors.textOnDark,
    fontSize: 16,
    lineHeight: 23,
  },
  reviewCard: {
    backgroundColor: "rgba(247, 250, 239, 0.07)",
    borderColor: "rgba(247, 250, 239, 0.12)",
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
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
  subtitle: {
    color: colors.textOnDark,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  summaryItem: {
    backgroundColor: "rgba(247, 250, 239, 0.08)",
    borderColor: "rgba(247, 250, 239, 0.12)",
    borderCurve: "continuous",
    borderRadius: radius.md,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xxs,
    minWidth: 132,
    padding: spacing.sm,
  },
  summaryLabel: {
    color: "rgba(247, 250, 239, 0.64)",
  },
  summaryValue: {
    color: colors.textOnDark,
    textTransform: "capitalize",
  },
  title: {
    color: colors.textOnDark,
  },
});
