import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, Text } from "react-native";
import type { MediaStreamTrack } from "@daily-co/react-native-webrtc";
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
  getRealtimeCameraFrameTickEvent,
  getRealtimeCameraStepStartEvent,
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
import type { AgentProcessingPhase } from "@/src/features/inspection/pipecat-voice-boundary";
import { captureRealtimeFrame } from "@/src/features/inspection/realtime-frame-capture";
import { RealtimeCameraScreen } from "@/src/features/inspection/realtime-camera-screen";
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
const CAMERA_STEP_START_DELAY_MS = 450;
const CAMERA_FRAME_JUDGE_INTERVAL_MS = 4600;
const CAMERA_FRAME_JUDGE_RELEASE_DELAY_MS = 900;
const INSPECTION_SCREEN_LOG_PREFIX = "[inspection-screen]";
const SHOULD_LOG_INSPECTION_SCREEN_EVENTS = __DEV__;

function logInspectionScreen(event: string, data?: unknown) {
  if (!SHOULD_LOG_INSPECTION_SCREEN_EVENTS) {
    return;
  }

  if (data === undefined) {
    console.log(INSPECTION_SCREEN_LOG_PREFIX, event);
    return;
  }

  console.log(INSPECTION_SCREEN_LOG_PREFIX, event, data);
}

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
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(
    null,
  );
  const [pendingCaptureStepId, setPendingCaptureStepId] = useState<string | null>(
    null,
  );
  const activeStepRef = useRef<InspectionStep | null>(null);
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
  const cameraFrameJudgeTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const cameraFrameJudgeReleaseTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeVideoViewTagRef = useRef<number | null>(null);
  const activeAgentProcessingPhasesRef = useRef<Set<AgentProcessingPhase>>(
    new Set(),
  );
  const initialStepInstructionSentRef = useRef(false);
  const isAgentSpeakingRef = useRef(false);
  const isBusyRef = useRef(false);
  const isFrameJudgementInFlightRef = useRef(false);
  const isScreenMountedRef = useRef(true);

  useEffect(
    () => () => {
      isScreenMountedRef.current = false;
    },
    [],
  );

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

  const clearCameraFrameJudgeTimer = useCallback(() => {
    if (cameraFrameJudgeTimerRef.current) {
      clearInterval(cameraFrameJudgeTimerRef.current);
      cameraFrameJudgeTimerRef.current = null;
    }
  }, []);

  const clearCameraFrameJudgeReleaseTimer = useCallback(() => {
    if (cameraFrameJudgeReleaseTimerRef.current) {
      clearTimeout(cameraFrameJudgeReleaseTimerRef.current);
      cameraFrameJudgeReleaseTimerRef.current = null;
    }
  }, []);

  const releaseFrameJudgementWhenAgentIdle = useCallback(() => {
    clearCameraFrameJudgeReleaseTimer();
    cameraFrameJudgeReleaseTimerRef.current = setTimeout(() => {
      cameraFrameJudgeReleaseTimerRef.current = null;

      if (
        isAgentSpeakingRef.current ||
        activeAgentProcessingPhasesRef.current.size > 0
      ) {
        logInspectionScreen("camera-frame-judge:release-deferred", {
          activePhases: Array.from(activeAgentProcessingPhasesRef.current),
          isAgentSpeaking: isAgentSpeakingRef.current,
        });
        return;
      }

      if (isFrameJudgementInFlightRef.current) {
        logInspectionScreen("camera-frame-judge:released");
      }
      isFrameJudgementInFlightRef.current = false;
    }, CAMERA_FRAME_JUDGE_RELEASE_DELAY_MS);
  }, [clearCameraFrameJudgeReleaseTimer]);

  const resetFrameJudgementGate = useCallback(() => {
    clearCameraFrameJudgeReleaseTimer();
    activeAgentProcessingPhasesRef.current.clear();
    isFrameJudgementInFlightRef.current = false;
  }, [clearCameraFrameJudgeReleaseTimer]);

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
        if (!isScreenMountedRef.current) {
          return;
        }

        if (event.type === "agent-speaking-started") {
          isAgentSpeakingRef.current = true;
          isFrameJudgementInFlightRef.current = true;
          clearCameraFrameJudgeReleaseTimer();
          logInspectionScreen("agent-speaking-started");
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
          isAgentSpeakingRef.current = false;
          logInspectionScreen("agent-speaking-stopped");
          greetingGateRef.current = recordInspectionGreetingStopped(
            greetingGateRef.current,
          );
          releaseFrameJudgementWhenAgentIdle();
          scheduleGreetingHandoff();
          return;
        }

        if (event.type === "agent-processing-started") {
          activeAgentProcessingPhasesRef.current.add(event.phase);
          isFrameJudgementInFlightRef.current = true;
          clearCameraFrameJudgeReleaseTimer();
          logInspectionScreen("agent-processing-started", {
            activePhases: Array.from(activeAgentProcessingPhasesRef.current),
            phase: event.phase,
          });
          return;
        }

        if (event.type === "agent-processing-stopped") {
          activeAgentProcessingPhasesRef.current.delete(event.phase);
          logInspectionScreen("agent-processing-stopped", {
            activePhases: Array.from(activeAgentProcessingPhasesRef.current),
            phase: event.phase,
          });
          releaseFrameJudgementWhenAgentIdle();
          return;
        }

        if (event.type === "local-video-track") {
          logInspectionScreen("local-video-track", {
            hasTrack: Boolean(event.videoTrack),
            id: event.videoTrack?.id ?? null,
            readyState: event.videoTrack?.readyState ?? null,
          });
          setLocalVideoTrack(event.videoTrack);
          return;
        }

        if (event.type === "capture-requested") {
          logInspectionScreen("capture-requested", { stepId: event.stepId });
          isFrameJudgementInFlightRef.current = false;
          setPendingCaptureStepId(event.stepId);
          return;
        }

        if (event.type === "inspection-control-ack") {
          logInspectionScreen("inspection-control-ack", {
            contentPreview: event.contentPreview,
          });
          return;
        }

        if (event.type === "inspection-control-error") {
          logInspectionScreen("inspection-control-error", {
            error: event.error,
          });
          isFrameJudgementInFlightRef.current = false;
          return;
        }

        if (event.type === "voice-ready") {
          logInspectionScreen("voice-ready");
        }
      }),
    [
      clearGreetingFinishTimer,
      clearCameraFrameJudgeReleaseTimer,
      releaseFrameJudgementWhenAgentIdle,
      scheduleGreetingHandoff,
      scheduleGreetingWordReveal,
    ],
  );

  const activeStep = session ? findActiveInspectionStep(session) : null;
  const stepMedia = activeStep ? getInspectionStepMedia(activeStep.id) : null;
  const currentFrame = stepMedia?.frames[frameIndex] ?? null;
  const isRealtimeCameraStep =
    activeStep?.kind === "photo" && activeStep.status !== "needs_observation";

  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

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
      setLocalVideoTrack(null);
      setPendingCaptureStepId(null);
      clearGreetingFinishTimer();
      clearGreetingWordTimer();
      clearCameraFrameJudgeTimer();
      resetFrameJudgementGate();
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
      clearCameraFrameJudgeTimer();
      resetFrameJudgementGate();
      void voiceDriver.disconnect();
    };
  }, [
    clearCameraFrameJudgeTimer,
    clearGreetingFinishTimer,
    clearGreetingWordTimer,
    resetFrameJudgementGate,
    sessionId,
    updateGreetingDisplayMessage,
    voiceDriver,
  ]);

  useEffect(() => {
    setAnalysis(null);
    setFrameIndex(0);
    clearCameraFrameJudgeTimer();
    resetFrameJudgementGate();
    initialStepInstructionSentRef.current = false;
    if (activeStep?.kind === "photo") {
      setAgentMessage(activeStep.instructions);
    }
  }, [
    activeStep?.id,
    activeStep?.instructions,
    activeStep?.kind,
    clearCameraFrameJudgeTimer,
    resetFrameJudgementGate,
  ]);

  useEffect(() => {
    const blockers: string[] = [];
    if (isLoading) {
      blockers.push("loading");
    }
    if (isGreetingActive) {
      blockers.push("greeting_active");
    }
    if (!session) {
      blockers.push("no_session");
    }
    if (!activeStep) {
      blockers.push("no_active_step");
    }
    if (!isRealtimeCameraStep) {
      blockers.push("not_realtime_camera_step");
    }
    if (activeStep?.status === "needs_observation") {
      blockers.push("needs_observation");
    }
    if (!localVideoTrack) {
      blockers.push("no_local_video_track");
    }
    if (initialStepInstructionSentRef.current) {
      blockers.push("already_sent");
    }

    if (blockers.length > 0) {
      if (activeStep?.kind === "photo") {
        logInspectionScreen("camera-start:waiting", {
          blockers,
          hasVideoTrack: Boolean(localVideoTrack),
          stepId: activeStep.id,
        });
      }
      return;
    }
    if (!session || !activeStep) {
      return;
    }

    initialStepInstructionSentRef.current = true;
    const activeStepIndex = session.plan.steps.findIndex(
      (step) => step.id === activeStep.id,
    );
    const startEvent = getRealtimeCameraStepStartEvent(
      activeStep,
      Math.max(0, activeStepIndex),
    );

    const startTimer = setTimeout(() => {
      logInspectionScreen("camera-start:send", {
        hasVideoTrack: Boolean(localVideoTrack),
        stepId: activeStep.id,
      });
      isFrameJudgementInFlightRef.current = true;
      clearCameraFrameJudgeReleaseTimer();
      void voiceDriver.sendControlEvent(startEvent).catch((error) => {
        initialStepInstructionSentRef.current = false;
        isFrameJudgementInFlightRef.current = false;
        logInspectionScreen(
          "camera-start:error",
          getInspectionErrorMessage(error),
        );
        setErrorMessage(getInspectionErrorMessage(error));
      });
    }, CAMERA_STEP_START_DELAY_MS);

    return () => {
      clearTimeout(startTimer);
    };
  }, [
    activeStep,
    clearCameraFrameJudgeReleaseTimer,
    isGreetingActive,
    isLoading,
    isRealtimeCameraStep,
    localVideoTrack,
    session,
    voiceDriver,
  ]);

  useEffect(() => {
    clearCameraFrameJudgeTimer();

    const blockers: string[] = [];
    if (isLoading) {
      blockers.push("loading");
    }
    if (isGreetingActive) {
      blockers.push("greeting_active");
    }
    if (!activeStep) {
      blockers.push("no_active_step");
    }
    if (!isRealtimeCameraStep) {
      blockers.push("not_realtime_camera_step");
    }
    if (activeStep?.status === "needs_observation") {
      blockers.push("needs_observation");
    }
    if (!localVideoTrack) {
      blockers.push("no_local_video_track");
    }

    if (blockers.length > 0) {
      return;
    }
    if (!activeStep) {
      return;
    }

    logInspectionScreen("camera-frame-tick:interval-started", {
      stepId: activeStep.id,
    });
    cameraFrameJudgeTimerRef.current = setInterval(() => {
      const activePhases = Array.from(activeAgentProcessingPhasesRef.current);
      if (
        isAgentSpeakingRef.current ||
        isBusyRef.current ||
        isFrameJudgementInFlightRef.current ||
        activePhases.length > 0
      ) {
        logInspectionScreen("camera-frame-tick:skipped", {
          activePhases,
          isAgentSpeaking: isAgentSpeakingRef.current,
          isBusy: isBusyRef.current,
          isFrameJudgementInFlight: isFrameJudgementInFlightRef.current,
          stepId: activeStep.id,
        });
        return;
      }

      logInspectionScreen("camera-frame-tick:send", { stepId: activeStep.id });
      isFrameJudgementInFlightRef.current = true;
      clearCameraFrameJudgeReleaseTimer();
      void voiceDriver
        .sendControlEvent(getRealtimeCameraFrameTickEvent(activeStep))
        .catch((error) => {
          isFrameJudgementInFlightRef.current = false;
          logInspectionScreen(
            "camera-frame-tick:error",
            getInspectionErrorMessage(error),
          );
          setErrorMessage(getInspectionErrorMessage(error));
        });
    }, CAMERA_FRAME_JUDGE_INTERVAL_MS);

    return clearCameraFrameJudgeTimer;
  }, [
    activeStep,
    clearCameraFrameJudgeTimer,
    clearCameraFrameJudgeReleaseTimer,
    isGreetingActive,
    isLoading,
    isRealtimeCameraStep,
    localVideoTrack,
    voiceDriver,
  ]);

  useEffect(() => {
    if (
      isLoading ||
      isGreetingActive ||
      !session ||
      !activeStep ||
      isRealtimeCameraStep ||
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
  }, [
    activeStep,
    isGreetingActive,
    isLoading,
    isRealtimeCameraStep,
    session,
    voiceDriver,
  ]);

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

  const playCaptureFlash = useCallback(() => {
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
  }, [captureFlash]);

  async function handleAutoCapture(step: InspectionStep, sampleKey: string) {
    playCaptureFlash();

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

  const handleRealtimeCapture = useCallback(
    async (stepId: string) => {
      const step = activeStepRef.current;
      if (!step || step.id !== stepId || isBusyRef.current) {
        return;
      }
      if (!localVideoTrack) {
        setErrorMessage("Realtime camera track is not ready.");
        return;
      }
      if (realtimeVideoViewTagRef.current === null) {
        setErrorMessage("Realtime camera view is not ready.");
        return;
      }

      isBusyRef.current = true;
      setIsBusy(true);
      setErrorMessage(null);

      await new Promise((resolve) => {
        setTimeout(resolve, step.autoCapture?.holdMs ?? 900);
      });

      if (activeStepRef.current?.id !== stepId) {
        isBusyRef.current = false;
        setIsBusy(false);
        return;
      }

      playCaptureFlash();

      try {
        logInspectionScreen("capture-frame:start", {
          viewTag: realtimeVideoViewTagRef.current,
        });
        const capture = await captureRealtimeFrame(realtimeVideoViewTagRef.current);
        logInspectionScreen("capture-frame-stored", {
          bytes: capture.bytes,
          height: capture.height,
          uri: capture.uri,
          width: capture.width,
        });

        const evidence = await savePhotoEvidence({
          image: {
            name: `${stepId}.jpg`,
            type: capture.mimeType,
            uri: capture.uri,
          },
          localUri: capture.uri,
          sampleKey: `${stepId}-realtime`,
          sessionId,
          stepId: step.id,
        });
        setSession(evidence.session);
        setAgentMessage(evidence.agentMessage);
        await voiceDriver.sendAgentMessage(evidence.agentMessage);
      } catch (error) {
        logInspectionScreen("capture-frame:error", getInspectionErrorMessage(error));
        setErrorMessage(getInspectionErrorMessage(error));
      } finally {
        setAnalysis(null);
        setIsBusy(false);
        isBusyRef.current = false;
      }
    },
    [localVideoTrack, playCaptureFlash, sessionId, voiceDriver],
  );

  const handleRealtimeVideoViewReady = useCallback(
    (viewTag: number | null) => {
      realtimeVideoViewTagRef.current = viewTag;
      logInspectionScreen("camera-view-ready", { viewTag });
    },
    [],
  );

  useEffect(() => {
    if (!pendingCaptureStepId) {
      return;
    }

    const stepId = pendingCaptureStepId;
    setPendingCaptureStepId(null);
    void handleRealtimeCapture(stepId);
  }, [handleRealtimeCapture, pendingCaptureStepId]);

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
  const activeStepIndex = activeStep
    ? session.plan.steps.findIndex((step) => step.id === activeStep.id)
    : -1;

  if (
    activeStep?.kind === "photo" &&
    activeStep.status !== "needs_observation" &&
    isRealtimeCameraStep
  ) {
    return (
      <RealtimeCameraScreen
        bottomInset={insets.bottom}
        captureFlash={captureFlash}
        errorMessage={errorMessage}
        instruction={agentMessage || activeStep.instructions}
        onVideoViewReady={handleRealtimeVideoViewReady}
        stepNumber={Math.max(0, activeStepIndex) + 1}
        stepTitle={activeStep.fieldName}
        topInset={insets.top}
        videoTrack={localVideoTrack}
      />
    );
  }

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
      !isRealtimeCameraStep &&
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
