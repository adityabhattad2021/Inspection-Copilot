import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, Text } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  analyzeLiveFrame,
  completeInspectionSession,
  getVoiceConfig,
  runEngineCheck,
  savePhotoEvidence,
  startInspectionSession,
  structureObservation,
  type InspectionSession,
  type InspectionStep,
  type LiveFrameAnalysis,
} from "@/src/api/client";
import {
  ProgressRail,
  StepHeader,
  colors,
  spacing,
  typography,
} from "@/src/components/ui";
import { getInspectionStepMedia } from "@/src/data/live-inspection-media";
import { CopilotStatusCard } from "@/src/features/inspection/copilot-status-card";
import { EngineGuidedCheck } from "@/src/features/inspection/engine-guided-check";
import {
  ENGINE_TRANSCRIPT,
  findActiveInspectionStep,
  getInspectionErrorMessage,
  getInspectionStepVoiceInstruction,
  getProgressSteps,
  getVehicleTitle,
} from "@/src/features/inspection/inspection-flow";
import {
  createInspectionGreetingGate,
  finishInspectionGreeting,
  getInspectionGreetingHandoffDelayMs,
  recordInspectionGreetingOutput,
  recordInspectionGreetingStarted,
  recordInspectionGreetingStopped,
} from "@/src/features/inspection/inspection-greeting-gate";
import { InspectionGreetingView } from "@/src/features/inspection/inspection-greeting-view";
import { InspectionUnavailableView } from "@/src/features/inspection/inspection-state-view";
import { InspectionStepCard } from "@/src/features/inspection/inspection-step-card";
import { ObservationCard } from "@/src/features/inspection/observation-card";
import { createInspectionVoiceDriver } from "@/src/features/inspection/pipecat-voice-boundary";
import {
  getNextWordStreamText,
  isWordStreamComplete,
  normalizeWordStreamText,
} from "@/src/features/inspection/word-stream";
import { LiveGuidanceCard } from "@/src/features/inspection/live-guidance-card";
import { getCachedProfile } from "@/src/features/onboarding/profile-storage";

type InspectionScreenProps = {
  sessionId: string;
};

const GREETING_WORD_REVEAL_MS = 145;
const GREETING_FINAL_DWELL_MS = 1000;

export function InspectionScreen({ sessionId }: InspectionScreenProps) {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<InspectionSession | null>(null);
  const [agentMessage, setAgentMessage] = useState("Connecting copilot...");
  const [analysis, setAnalysis] = useState<LiveFrameAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [greetingDisplayMessage, setGreetingDisplayMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isGreetingActive, setIsGreetingActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const captureFlash = useRef(new Animated.Value(0)).current;
  const greetingGateRef = useRef(createInspectionGreetingGate());
  const greetingDisplayMessageRef = useRef("");
  const greetingFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const greetingTargetMessageRef = useRef("");
  const greetingWordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const initialStepInstructionSentRef = useRef(false);

  const clearGreetingFinishTimer = useCallback(() => {
    if (greetingFinishTimerRef.current) {
      clearTimeout(greetingFinishTimerRef.current);
      greetingFinishTimerRef.current = null;
    }
  }, []);

  const clearGreetingWordTimer = useCallback(() => {
    if (greetingWordTimerRef.current) {
      clearTimeout(greetingWordTimerRef.current);
      greetingWordTimerRef.current = null;
    }
  }, []);

  const updateGreetingDisplayMessage = useCallback((nextMessage: string) => {
    greetingDisplayMessageRef.current = nextMessage;
    setGreetingDisplayMessage(nextMessage);
  }, []);

  const scheduleGreetingWordReveal = useCallback(() => {
    if (greetingWordTimerRef.current) {
      return;
    }

    greetingWordTimerRef.current = setTimeout(() => {
      greetingWordTimerRef.current = null;
      const nextMessage = getNextWordStreamText(
        greetingDisplayMessageRef.current,
        greetingTargetMessageRef.current,
      );

      updateGreetingDisplayMessage(nextMessage);

      if (!isWordStreamComplete(nextMessage, greetingTargetMessageRef.current)) {
        scheduleGreetingWordReveal();
      }
    }, GREETING_WORD_REVEAL_MS);
  }, [updateGreetingDisplayMessage]);

  const scheduleGreetingHandoff = useCallback(() => {
    const delay = getInspectionGreetingHandoffDelayMs(
      greetingGateRef.current,
      Date.now(),
    );

    if (delay === null) {
      return;
    }

    clearGreetingFinishTimer();
    greetingFinishTimerRef.current = setTimeout(() => {
      greetingFinishTimerRef.current = null;
      const nextDelay = getInspectionGreetingHandoffDelayMs(
        greetingGateRef.current,
        Date.now(),
      );

      if (nextDelay === null) {
        return;
      }

      if (nextDelay > 0) {
        scheduleGreetingHandoff();
        return;
      }

      greetingGateRef.current = finishInspectionGreeting(
        greetingGateRef.current,
      );
      greetingFinishTimerRef.current = setTimeout(() => {
        greetingFinishTimerRef.current = null;
        setIsGreetingActive(false);
      }, GREETING_FINAL_DWELL_MS);
    }, delay);
  }, [clearGreetingFinishTimer]);

  const voiceDriver = useMemo(
    () =>
      createInspectionVoiceDriver((event) => {
        if (event.type === "agent-speaking-started") {
          greetingGateRef.current = recordInspectionGreetingStarted(
            greetingGateRef.current,
          );
          clearGreetingFinishTimer();
          return;
        }

        if (event.type === "agent-message") {
          setAgentMessage(event.text);
          if (greetingGateRef.current.isActive) {
            greetingTargetMessageRef.current = normalizeWordStreamText(
              event.text,
            );
            scheduleGreetingWordReveal();
          }
          greetingGateRef.current = recordInspectionGreetingOutput(
            greetingGateRef.current,
            event.text,
            Date.now(),
          );
          scheduleGreetingHandoff();
          return;
        }

        if (event.type === "agent-speaking-stopped") {
          greetingGateRef.current = recordInspectionGreetingStopped(
            greetingGateRef.current,
          );
          scheduleGreetingHandoff();
        }
      }),
    [
      clearGreetingFinishTimer,
      scheduleGreetingHandoff,
      scheduleGreetingWordReveal,
    ],
  );

  const activeStep = session ? findActiveInspectionStep(session) : null;
  const stepMedia = activeStep ? getInspectionStepMedia(activeStep.id) : null;
  const currentFrame = stepMedia?.frames[frameIndex] ?? null;

  useEffect(() => {
    let mounted = true;

    async function startInspection() {
      if (!sessionId) {
        setErrorMessage("Missing inspection session id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setAgentMessage("");
      greetingTargetMessageRef.current = "";
      updateGreetingDisplayMessage("");
      setErrorMessage(null);
      clearGreetingFinishTimer();
      clearGreetingWordTimer();
      greetingGateRef.current = createInspectionGreetingGate();
      initialStepInstructionSentRef.current = false;
      setIsGreetingActive(true);

      try {
        const [jockeyProfile, voiceConfig] = await Promise.all([
          getCachedProfile().catch(() => null),
          getVoiceConfig(),
        ]);
        if (!voiceConfig.ready) {
          const missing = voiceConfig.missing.join(", ");
          throw new Error(
            missing
              ? `Realtime voice is not ready. Missing: ${missing}.`
              : "Realtime voice is not ready.",
          );
        }

        const startedSession = await startInspectionSession(sessionId, {
          jockeyName: jockeyProfile?.jockeyName,
          languageCode: jockeyProfile?.languageCode,
        });
        await voiceDriver.connect({
          jockeyName: jockeyProfile?.jockeyName,
          languageCode: jockeyProfile?.languageCode,
          sessionId,
          startUrl: voiceConfig.startUrl,
        });
        if (mounted) {
          setSession(startedSession.session);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(getInspectionErrorMessage(error));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void startInspection();

    return () => {
      mounted = false;
      clearGreetingFinishTimer();
      clearGreetingWordTimer();
      void voiceDriver.disconnect();
    };
  }, [
    clearGreetingFinishTimer,
    clearGreetingWordTimer,
    sessionId,
    updateGreetingDisplayMessage,
    voiceDriver,
  ]);

  useEffect(() => {
    setAnalysis(null);
    setFrameIndex(0);
  }, [activeStep?.id]);

  useEffect(() => {
    if (
      isLoading ||
      isGreetingActive ||
      !session ||
      !activeStep ||
      initialStepInstructionSentRef.current
    ) {
      return;
    }

    initialStepInstructionSentRef.current = true;
    const activeStepIndex = session.plan.steps.findIndex(
      (step) => step.id === activeStep.id,
    );
    const instruction = getInspectionStepVoiceInstruction(
      activeStep,
      Math.max(0, activeStepIndex),
    );
    setAgentMessage(instruction);
    void voiceDriver.sendAgentMessage(instruction).catch((error) => {
      setErrorMessage(getInspectionErrorMessage(error));
    });
  }, [activeStep, isGreetingActive, isLoading, session, voiceDriver]);

  async function handleAnalyzeFrame() {
    if (!activeStep || !currentFrame || isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const result = await analyzeLiveFrame({
        sampleKey: currentFrame.key,
        sessionId,
        stepId: activeStep.id,
      });
      setAnalysis(result);
      setAgentMessage(result.guidance);
      await voiceDriver.sendAgentMessage(result.guidance);

      if (result.readyToCapture) {
        setTimeout(() => {
          void handleAutoCapture(activeStep, currentFrame.key);
        }, activeStep.autoCapture?.holdMs ?? 900);
      } else {
        setIsBusy(false);
      }
    } catch (error) {
      setErrorMessage(getInspectionErrorMessage(error));
      setIsBusy(false);
    }
  }

  async function handleAutoCapture(step: InspectionStep, sampleKey: string) {
    Animated.sequence([
      Animated.timing(captureFlash, {
        duration: 120,
        toValue: 0.85,
        useNativeDriver: true,
      }),
      Animated.timing(captureFlash, {
        duration: 360,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const evidence = await savePhotoEvidence({
        localUri: `capture://${sampleKey}`,
        sampleKey,
        sessionId,
        stepId: step.id,
      });
      setSession(evidence.session);
      setAgentMessage(evidence.agentMessage);
      await voiceDriver.sendAgentMessage(evidence.agentMessage);
    } catch (error) {
      setErrorMessage(getInspectionErrorMessage(error));
    } finally {
      setAnalysis(null);
      setIsBusy(false);
    }
  }

  function handleUseNextFrame() {
    if (!stepMedia) {
      return;
    }

    setAnalysis(null);
    setFrameIndex((current) =>
      Math.min(current + 1, stepMedia.frames.length - 1),
    );
  }

  async function handleObservationAnswer() {
    if (!activeStep || !stepMedia?.observationTranscript || isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const observation = await structureObservation({
        sessionId,
        stepId: activeStep.id,
        transcript: stepMedia.observationTranscript,
      });
      setSession(observation.session);
      setAgentMessage(observation.summary);
      await voiceDriver.sendAgentMessage(observation.summary);
    } catch (error) {
      setErrorMessage(getInspectionErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEngineSubmit() {
    if (!activeStep || isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const engine = await runEngineCheck({
        phase: "final",
        sessionId,
        stepId: activeStep.id,
        transcript: ENGINE_TRANSCRIPT,
      });
      if (engine.session) {
        setSession(engine.session);
      }
      setAgentMessage(engine.agentMessage);
      await voiceDriver.sendAgentMessage(engine.agentMessage);

      const completed = await completeInspectionSession(sessionId);
      setAgentMessage(completed.agentMessage);
      await voiceDriver.sendAgentMessage(completed.agentMessage);
      setIsComplete(true);
      setTimeout(() => {
        router.replace("/" as never);
      }, 1400);
    } catch (error) {
      setErrorMessage(getInspectionErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  if (errorMessage && !session) {
    return <InspectionUnavailableView message={errorMessage} />;
  }

  if (isLoading || isGreetingActive) {
    return <InspectionGreetingView message={greetingDisplayMessage} />;
  }

  if (!session) {
    return null;
  }

  const vehicleTitle = getVehicleTitle(session);
  const progressSteps = getProgressSteps(session);

  return (
    <ScrollView
      contentContainerStyle={{
        backgroundColor: colors.background,
        flexGrow: 1,
        gap: spacing.lg,
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
        statusLabel={isComplete ? "Submitted" : "Live"}
        statusTone={isComplete ? "success" : "ai"}
        title={vehicleTitle}
      />

      <CopilotStatusCard message={agentMessage} />

      <ProgressRail steps={progressSteps} />

      {activeStep ? <InspectionStepCard step={activeStep} /> : null}

      {activeStep?.status === "needs_observation" && stepMedia ? (
        <ObservationCard
          isBusy={isBusy}
          onAnswer={handleObservationAnswer}
          transcript={stepMedia.observationTranscript ?? ""}
        />
      ) : null}

      {activeStep?.kind === "engine-guided" ? (
        <EngineGuidedCheck isBusy={isBusy} onSubmit={handleEngineSubmit} />
      ) : null}

      {activeStep?.kind === "photo" &&
      activeStep.status !== "needs_observation" &&
      currentFrame ? (
        <LiveGuidanceCard
          analysis={analysis}
          captureFlash={captureFlash}
          expectedParts={activeStep.expectedParts}
          frame={currentFrame}
          isBusy={isBusy}
          onAnalyze={handleAnalyzeFrame}
          onUseNextFrame={handleUseNextFrame}
        />
      ) : null}

      {errorMessage ? (
        <Text selectable style={[typography.small, { color: colors.danger }]}>
          {errorMessage}
        </Text>
      ) : null}
    </ScrollView>
  );
}
