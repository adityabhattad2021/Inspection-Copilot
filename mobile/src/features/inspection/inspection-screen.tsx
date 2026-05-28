import { useEffect, useMemo, useRef, useState } from "react";
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
  getProgressSteps,
  getVehicleTitle,
} from "@/src/features/inspection/inspection-flow";
import {
  InspectionUnavailableView,
  LoadingInspectionView,
} from "@/src/features/inspection/inspection-state-view";
import { InspectionStepCard } from "@/src/features/inspection/inspection-step-card";
import { ObservationCard } from "@/src/features/inspection/observation-card";
import { createInspectionVoiceDriver } from "@/src/features/inspection/pipecat-voice-boundary";
import { LiveGuidanceCard } from "@/src/features/inspection/live-guidance-card";
import { getCachedProfile } from "@/src/features/onboarding/profile-storage";

type InspectionScreenProps = {
  sessionId: string;
};

export function InspectionScreen({ sessionId }: InspectionScreenProps) {
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<InspectionSession | null>(null);
  const [agentMessage, setAgentMessage] = useState("Connecting copilot...");
  const [analysis, setAnalysis] = useState<LiveFrameAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const captureFlash = useRef(new Animated.Value(0)).current;
  const voiceDriver = useMemo(
    () =>
      createInspectionVoiceDriver((event) => {
        if (event.type === "agent-message") {
          setAgentMessage(event.text);
        }
      }),
    [],
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
      setErrorMessage(null);

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
      void voiceDriver.disconnect();
    };
  }, [sessionId, voiceDriver]);

  useEffect(() => {
    setAnalysis(null);
    setFrameIndex(0);
  }, [activeStep?.id]);

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

  if (isLoading) {
    return <LoadingInspectionView message="Starting Pipecat copilot" />;
  }

  if (errorMessage && !session) {
    return <InspectionUnavailableView message={errorMessage} />;
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
