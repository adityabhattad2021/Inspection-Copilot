import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  StatusPill,
  colors,
  radius,
  spacing,
  typography,
} from "@/src/components/ui";
import {
  ONBOARDING_STEPS,
  SUPPORTED_INSTRUCTION_LANGUAGES,
  createJockeyProfile,
  getInstructionLanguage,
  type InstructionLanguageCode,
  type JockeyProfile,
  type OnboardingStepId,
} from "@/src/features/onboarding/profile";

type JockeyOnboardingScreenProps = {
  onContinue: (profile: JockeyProfile) => void;
};

export function JockeyOnboardingScreen({
  onContinue,
}: JockeyOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const buttonLift = useRef(new Animated.Value(0)).current;
  const contentLift = useRef(new Animated.Value(0)).current;
  const [stepId, setStepId] = useState<OnboardingStepId>("narrative");
  const [jockeyName, setJockeyName] = useState("");
  const [languageCode, setLanguageCode] =
    useState<InstructionLanguageCode>("en-IN");

  const selectedLanguage = useMemo(
    () => getInstructionLanguage(languageCode),
    [languageCode],
  );
  const currentStepIndex = ONBOARDING_STEPS.findIndex(
    (step) => step.id === stepId,
  );
  const canContinue = stepId !== "name" || jockeyName.trim().length >= 2;

  useEffect(() => {
    const keyboardShowEvent =
      process.env.EXPO_OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const keyboardHideEvent =
      process.env.EXPO_OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(keyboardShowEvent, (event) => {
      if (stepId !== "name") {
        return;
      }

      const keyboardHeight = event.endCoordinates.height;
      const buttonLiftValue = Math.max(
        0,
        keyboardHeight - insets.bottom + spacing.xl,
      );
      const contentLiftValue = Math.min(
        132,
        Math.max(spacing.xxl + spacing.sm, keyboardHeight * 0.34),
      );

      Animated.parallel([
        Animated.timing(contentLift, {
          duration: event.duration ?? 220,
          easing: Easing.out(Easing.cubic),
          toValue: -contentLiftValue,
          useNativeDriver: true,
        }),
        Animated.timing(buttonLift, {
          duration: event.duration ?? 220,
          easing: Easing.out(Easing.cubic),
          toValue: -buttonLiftValue,
          useNativeDriver: true,
        }),
      ]).start();
    });

    const hideSubscription = Keyboard.addListener(keyboardHideEvent, (event) => {
      Animated.parallel([
        Animated.timing(contentLift, {
          duration: event.duration ?? 180,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(buttonLift, {
          duration: event.duration ?? 180,
          easing: Easing.out(Easing.cubic),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [buttonLift, contentLift, insets.bottom, stepId]);

  function goToStep(nextStepId: OnboardingStepId) {
    Keyboard.dismiss();
    setStepId(nextStepId);
    Animated.parallel([
      Animated.timing(contentLift, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(buttonLift, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function handlePrimaryPress() {
    if (stepId === "narrative") {
      goToStep("name");
      return;
    }

    if (stepId === "name") {
      if (canContinue) {
        goToStep("language");
      }
      return;
    }

    onContinue(
      createJockeyProfile({
        jockeyName,
        languageCode,
      }),
    );
  }

  function handleBackPress() {
    if (stepId === "language") {
      goToStep("name");
      return;
    }

    if (stepId === "name") {
      goToStep("narrative");
    }
  }

  const primaryLabel =
    stepId === "narrative"
      ? "Get started"
      : stepId === "name"
        ? "Continue"
        : "Start inspection";

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
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <View
        style={{
          flex: 1,
          gap: spacing.xxl,
          justifyContent: "space-between",
        }}
      >
        <OnboardingChrome
          currentStepIndex={currentStepIndex}
          onBack={handleBackPress}
          showBack={stepId !== "narrative"}
        />

        {stepId === "name" ? (
          <View
            style={{
              flex: 1,
              gap: spacing.xl,
              justifyContent: "space-between",
            }}
          >
            <Animated.View
              style={{
                flex: 1,
                justifyContent: "center",
                transform: [{ translateY: contentLift }],
              }}
            >
              <NameStep jockeyName={jockeyName} onChangeName={setJockeyName} />
            </Animated.View>

            <Animated.View
              style={{
                transform: [{ translateY: buttonLift }],
              }}
            >
              <Button
                disabled={!canContinue}
                label={primaryLabel}
                onPress={handlePrimaryPress}
                size="lg"
              />
            </Animated.View>
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              gap: spacing.xl,
              justifyContent: "space-between",
            }}
          >
            <View style={{ gap: spacing.xl }}>
              {stepId === "narrative" ? <NarrativeStep /> : null}
              {stepId === "language" ? (
                <LanguageStep
                  languageCode={languageCode}
                  onSelectLanguage={setLanguageCode}
                  selectedSample={selectedLanguage.sampleInstruction}
                />
              ) : null}
            </View>

            <Button
              disabled={!canContinue}
              label={primaryLabel}
              onPress={handlePrimaryPress}
              size="lg"
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

type OnboardingChromeProps = {
  currentStepIndex: number;
  onBack: () => void;
  showBack: boolean;
};

function OnboardingChrome({
  currentStepIndex,
  onBack,
  showBack,
}: OnboardingChromeProps) {
  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
          minHeight: 32,
        }}
      >
        <Text selectable style={typography.small}>
          {currentStepIndex + 1} / {ONBOARDING_STEPS.length}
        </Text>
        {showBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
            <Text style={[typography.label, { color: colors.textMuted }]}>
              Back
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {ONBOARDING_STEPS.map((step, index) => (
          <View
            key={step.id}
            style={{
              backgroundColor:
                index <= currentStepIndex ? colors.camera : colors.surfaceStrong,
              borderRadius: radius.pill,
              flex: 1,
              height: 4,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function NarrativeStep() {
  return (
    <View style={{ gap: spacing.lg }}>
      <StatusPill label="Cars24 Jockey Copilot" tone="ai" />
      <View style={{ gap: spacing.md }}>
        <Text
          selectable
          style={[
            typography.title,
            {
              fontSize: 34,
              lineHeight: 40,
            },
          ]}
        >
          Your AI inspection copilot
        </Text>
        <Text selectable style={[typography.subtitle, { fontSize: 17 }]}>
          Get live camera guidance, voice instructions, and step-by-step
          inspection support in your language.
        </Text>
      </View>
    </View>
  );
}

type NameStepProps = {
  jockeyName: string;
  onChangeName: (value: string) => void;
};

function NameStep({ jockeyName, onChangeName }: NameStepProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={typography.eyebrow}>
          Jockey profile
        </Text>
        <Text
          selectable
          style={[
            typography.title,
            {
              fontSize: 30,
              lineHeight: 36,
            },
          ]}
        >
          What should Copilot call you?
        </Text>
      </View>

      <TextInput
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus
        onChangeText={onChangeName}
        placeholder="Enter your name"
        placeholderTextColor={colors.textSubtle}
        returnKeyType="done"
        style={{
          backgroundColor: colors.white,
          borderColor: colors.border,
          borderCurve: "continuous",
          borderRadius: radius.md,
          borderWidth: 1,
          color: colors.text,
          fontSize: 20,
          fontWeight: "700",
          minHeight: 60,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
        value={jockeyName}
      />
    </View>
  );
}

type LanguageStepProps = {
  languageCode: InstructionLanguageCode;
  onSelectLanguage: (languageCode: InstructionLanguageCode) => void;
  selectedSample: string;
};

function LanguageStep({
  languageCode,
  onSelectLanguage,
  selectedSample,
}: LanguageStepProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text selectable style={typography.eyebrow}>
          Voice instructions
        </Text>
        <Text
          selectable
          style={[
            typography.title,
            {
              fontSize: 30,
              lineHeight: 36,
            },
          ]}
        >
          Choose instruction language
        </Text>
      </View>

      <View style={{ gap: spacing.xs }}>
        {SUPPORTED_INSTRUCTION_LANGUAGES.map((language) => {
          const selected = language.code === languageCode;

          return (
            <Pressable
              accessibilityRole="button"
              key={language.code}
              onPress={() => onSelectLanguage(language.code)}
              style={({ pressed }) => [
                {
                  alignItems: "center",
                  backgroundColor: selected ? colors.camera : colors.white,
                  borderColor: selected ? colors.ai : colors.border,
                  borderCurve: "continuous",
                  borderRadius: radius.md,
                  borderWidth: 1,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  minHeight: 56,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                },
                pressed ? { opacity: 0.72 } : null,
              ]}
            >
              <Text
                style={[
                  typography.label,
                  { color: selected ? colors.textOnDark : colors.text },
                ]}
              >
                {language.label}
              </Text>
              <View
                style={{
                  backgroundColor: selected ? colors.ai : colors.transparent,
                  borderColor: selected ? colors.ai : colors.borderStrong,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  height: 18,
                  width: 18,
                }}
              />
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
          borderCurve: "continuous",
          borderRadius: radius.md,
          borderWidth: 1,
          padding: spacing.md,
        }}
      >
        <Text selectable style={typography.subtitle}>
          {selectedSample}
        </Text>
      </View>
    </View>
  );
}
