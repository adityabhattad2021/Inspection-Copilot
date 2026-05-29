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
import { logInspectionFlowEvent } from "@/src/features/inspection/inspection-debug-log";
import {
  EngineGuidedCheck,
  getEngineAnswerTranscript,
  type EngineQnaAnswers,
} from "@/src/features/inspection/engine-guided-check";
import {
  findActiveInspectionStep,
  getCapturedPhotoReviewEvent,
  getInspectionErrorMessage,
  getInspectionStepChangedEvent,
  getProgressSteps,
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
import { NeedsObservationScreen } from "@/src/features/inspection/needs-observation-screen";
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

type CompletionSpeechWait = {
  resolve: () => void;
  started: boolean;
  timeout: ReturnType<typeof setTimeout>;
};

const GREETING_WORD_REVEAL_MS = 145;
const GREETING_FINAL_DWELL_MS = 1000;
const CAMERA_STEP_START_DELAY_MS = 450;
const CAMERA_FRAME_JUDGE_RELEASE_DELAY_MS = 180;
const AGENT_IDLE_POLL_MS = 160;
const AGENT_IDLE_TIMEOUT_MS = 6000;
const COMPLETION_NAVIGATION_DWELL_MS = 650;
const COMPLETION_SPEECH_TIMEOUT_MS = 12000;
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
  const [observationTranscript, setObservationTranscript] = useState("");
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(
    null,
  );
  const activeStepRef = useRef<InspectionStep | null>(null);
  const agentUtteranceRef = useRef("");
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
  const lastLoggedScreenStateRef = useRef<string | null>(null);
  const hasRequestedInspectionCompletionRef = useRef(false);
  const completionRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const completionSpeechWaitRef = useRef<CompletionSpeechWait | null>(null);

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

  const clearCompletionRedirectTimer = useCallback(() => {
    if (completionRedirectTimerRef.current) {
      clearTimeout(completionRedirectTimerRef.current);
      completionRedirectTimerRef.current = null;
    }
  }, []);

  const resolveCompletionSpeechWait = useCallback((reason: string) => {
    const pending = completionSpeechWaitRef.current;
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    completionSpeechWaitRef.current = null;
    logInspectionScreen("completion-speech-wait:resolved", { reason });
    logInspectionFlowEvent({
      event: "completion_speech_wait_resolved",
      payload: { reason },
      screen: "voice_runtime",
      sessionId,
      stepId: activeStepRef.current?.id,
    });
    pending.resolve();
  }, [sessionId]);

  const startCompletionSpeechWait = useCallback(() => {
    if (completionSpeechWaitRef.current) {
      resolveCompletionSpeechWait("superseded");
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        resolveCompletionSpeechWait("timeout");
      }, COMPLETION_SPEECH_TIMEOUT_MS);

      completionSpeechWaitRef.current = {
        resolve,
        started: false,
        timeout,
      };
    });
  }, [resolveCompletionSpeechWait]);

  const waitForAgentIdle = useCallback(() => {
    const startedAt = Date.now();

    return new Promise<void>((resolve) => {
      const poll = () => {
        const isIdle =
          !isAgentSpeakingRef.current &&
          activeAgentProcessingPhasesRef.current.size === 0;
        const didTimeout = Date.now() - startedAt >= AGENT_IDLE_TIMEOUT_MS;

        if (isIdle || didTimeout) {
          if (didTimeout && !isIdle) {
            logInspectionScreen("agent-idle-wait:timeout", {
              activePhases: Array.from(activeAgentProcessingPhasesRef.current),
              isAgentSpeaking: isAgentSpeakingRef.current,
            });
          }
          resolve();
          return;
        }

        setTimeout(poll, AGENT_IDLE_POLL_MS);
      };

      poll();
    });
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
          agentUtteranceRef.current = "";
          if (completionSpeechWaitRef.current) {
            completionSpeechWaitRef.current.started = true;
            logInspectionScreen("completion-speech-wait:started");
            logInspectionFlowEvent({
              event: "completion_speech_wait_started",
              screen: "voice_runtime",
              sessionId,
              stepId: activeStepRef.current?.id,
            });
          }
          clearCameraFrameJudgeReleaseTimer();
          logInspectionScreen("agent-speaking-started");
          logInspectionFlowEvent({
            event: "agent_speaking_started",
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
          greetingGateRef.current = recordInspectionGreetingStarted(
            greetingGateRef.current,
          );
          clearGreetingFinishTimer();
          return;
        }

        if (event.type === "agent-message") {
          const streamedAgentMessage = normalizeWordStreamText(event.text);
          agentUtteranceRef.current = streamedAgentMessage;
          if (greetingGateRef.current.isActive) {
            setAgentMessage(streamedAgentMessage);
            greetingTargetMessageRef.current = streamedAgentMessage;
            scheduleGreetingWordReveal();
          } else {
            setAgentMessage(streamedAgentMessage);
          }
          greetingGateRef.current = recordInspectionGreetingOutput(
            greetingGateRef.current,
            streamedAgentMessage,
            Date.now(),
          );
          scheduleGreetingHandoff();
          return;
        }

        if (event.type === "agent-speaking-stopped") {
          isAgentSpeakingRef.current = false;
          const finalAgentMessage = normalizeWordStreamText(
            agentUtteranceRef.current,
          ).trim();
          if (finalAgentMessage) {
            setAgentMessage(finalAgentMessage);
            logInspectionFlowEvent({
              event: "agent_message_final",
              payload: { text: finalAgentMessage },
              screen: "voice_runtime",
              sessionId,
              stepId: activeStepRef.current?.id,
            });
          }
          logInspectionScreen("agent-speaking-stopped");
          logInspectionFlowEvent({
            event: "agent_speaking_stopped",
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
          greetingGateRef.current = recordInspectionGreetingStopped(
            greetingGateRef.current,
          );
          if (completionSpeechWaitRef.current?.started) {
            resolveCompletionSpeechWait("agent_speaking_stopped");
          }
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
          logInspectionFlowEvent({
            event: "agent_processing_started",
            payload: {
              activePhases: Array.from(activeAgentProcessingPhasesRef.current),
              phase: event.phase,
            },
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
          return;
        }

        if (event.type === "agent-processing-stopped") {
          activeAgentProcessingPhasesRef.current.delete(event.phase);
          logInspectionScreen("agent-processing-stopped", {
            activePhases: Array.from(activeAgentProcessingPhasesRef.current),
            phase: event.phase,
          });
          logInspectionFlowEvent({
            event: "agent_processing_stopped",
            payload: {
              activePhases: Array.from(activeAgentProcessingPhasesRef.current),
              phase: event.phase,
            },
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
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
          logInspectionFlowEvent({
            event: "local_video_track",
            payload: {
              hasTrack: Boolean(event.videoTrack),
              id: event.videoTrack?.id ?? null,
              readyState: event.videoTrack?.readyState ?? null,
            },
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
          setLocalVideoTrack(event.videoTrack);
          return;
        }

        if (event.type === "capture-requested") {
          logInspectionScreen("capture-requested", { stepId: event.stepId });
          logInspectionFlowEvent({
            event: "capture_requested",
            payload: { requestedStepId: event.stepId },
            screen: "voice_runtime",
            sessionId,
            stepId: event.stepId,
          });
          isFrameJudgementInFlightRef.current = false;
          return;
        }

        if (event.type === "frame-intervention") {
          logInspectionScreen("frame-intervention", {
            readyToCapture: event.readyToCapture,
            status: event.status,
            text: event.text,
          });
          logInspectionFlowEvent({
            event: "frame_intervention_received",
            payload: {
              readyToCapture: event.readyToCapture,
              status: event.status,
              text: event.text,
            },
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
          return;
        }

        if (event.type === "inspection-control-ack") {
          logInspectionScreen("inspection-control-ack", {
            contentPreview: event.contentPreview,
          });
          logInspectionFlowEvent({
            event: "inspection_control_ack",
            payload: { contentPreview: event.contentPreview },
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
          return;
        }

        if (event.type === "inspection-control-error") {
          logInspectionScreen("inspection-control-error", {
            error: event.error,
          });
          logInspectionFlowEvent({
            event: "inspection_control_error",
            payload: { error: event.error },
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
          isFrameJudgementInFlightRef.current = false;
          return;
        }

        if (event.type === "voice-session-updated") {
          logInspectionScreen("voice-session-updated", {
            message: event.message,
            nextStepId: event.nextStep?.id ?? null,
            resultType: event.resultType,
          });
          logInspectionFlowEvent({
            event: "voice_session_updated",
            payload: {
              message: event.message,
              nextStepId: event.nextStep?.id ?? null,
              resultType: event.resultType,
            },
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
          setSession(event.session);
          setObservationTranscript("");
          return;
        }

        if (event.type === "user-transcript") {
          logInspectionScreen("user-transcript", event.text);
          logInspectionFlowEvent({
            event: "user_transcript",
            payload: { text: event.text },
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
          if (activeStepRef.current?.status === "needs_observation") {
            setObservationTranscript(event.text);
          }
          return;
        }

        if (event.type === "voice-ready") {
          logInspectionScreen("voice-ready");
          logInspectionFlowEvent({
            event: "voice_ready",
            screen: "voice_runtime",
            sessionId,
            stepId: activeStepRef.current?.id,
          });
        }
      }),
    [
      clearGreetingFinishTimer,
      clearCameraFrameJudgeReleaseTimer,
      releaseFrameJudgementWhenAgentIdle,
      resolveCompletionSpeechWait,
      scheduleGreetingHandoff,
      scheduleGreetingWordReveal,
      sessionId,
    ],
  );

  const activeStep = session ? findActiveInspectionStep(session) : null;
  const stepMedia = activeStep ? getInspectionStepMedia(activeStep.id) : null;
  const currentFrame = stepMedia?.frames[frameIndex] ?? null;
  const isRealtimeCameraStep =
    activeStep?.kind === "photo" && activeStep.status !== "needs_observation";
  const visibleScreen = useMemo(() => {
    if (errorMessage && !session) {
      return "inspection_unavailable";
    }
    if (isLoading || isGreetingActive) {
      return "inspection_greeting";
    }
    if (!session) {
      return "inspection_empty";
    }
    if (activeStep?.status === "needs_observation") {
      return "needs_observation";
    }
    if (isRealtimeCameraStep) {
      return "realtime_camera";
    }
    if (activeStep?.kind === "engine-guided") {
      return "engine_guided";
    }
    return "inspection_overview";
  }, [
    activeStep?.kind,
    activeStep?.status,
    errorMessage,
    isGreetingActive,
    isLoading,
    isRealtimeCameraStep,
    session,
  ]);
  const screenStatePayload = useMemo(() => {
    const completedStepCount =
      session?.plan.steps.filter((step) => step.status === "complete").length ??
      0;

    return {
      activeStep: activeStep
        ? {
            fieldName: activeStep.fieldName,
            id: activeStep.id,
            instructions: activeStep.instructions,
            kind: activeStep.kind,
            section: activeStep.section,
            status: activeStep.status,
          }
        : null,
      analysis: analysis
        ? {
            confidence: analysis.confidence,
            guidance: analysis.guidance,
            readyToCapture: analysis.readyToCapture,
            status: analysis.status,
          }
        : null,
      errorMessage,
      frame: currentFrame
        ? {
            key: currentFrame.key,
            label: currentFrame.label,
          }
        : null,
      frameIndex,
      hasLocalVideoTrack: Boolean(localVideoTrack),
      isBusy,
      isComplete,
      isGreetingActive,
      isLoading,
      progress: session
        ? {
            completedStepCount,
            totalStepCount: session.plan.steps.length,
          }
        : null,
      screen: visibleScreen,
      showingMessage:
        visibleScreen === "inspection_greeting"
          ? "Inspection greeting"
          : agentMessage || null,
      vehicle: session
        ? {
            registrationNumber: session.vehicle.registrationNumber,
            title: getVehicleTitle(session),
          }
        : null,
    };
  }, [
    activeStep,
    agentMessage,
    analysis,
    currentFrame,
    errorMessage,
    frameIndex,
    isBusy,
    isComplete,
    isGreetingActive,
    isLoading,
    localVideoTrack,
    session,
    visibleScreen,
  ]);
  const screenStateKey = useMemo(
    () => JSON.stringify(screenStatePayload),
    [screenStatePayload],
  );

  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  useEffect(() => {
    if (lastLoggedScreenStateRef.current === screenStateKey) {
      return;
    }

    lastLoggedScreenStateRef.current = screenStateKey;
    logInspectionFlowEvent({
      event: "screen_state",
      payload: screenStatePayload,
      screen: visibleScreen,
      sessionId,
      stepId: activeStep?.id,
    });
  }, [
    activeStep?.id,
    screenStateKey,
    screenStatePayload,
    sessionId,
    visibleScreen,
  ]);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  useEffect(() => {
    let mounted = true;

    async function startInspection() {
      if (!sessionId) {
        logInspectionFlowEvent({
          event: "inspection_start_failed",
          payload: { reason: "missing_session_id" },
          screen: "inspection_start",
        });
        setErrorMessage("Missing inspection session id.");
        setIsLoading(false);
        return;
      }

      logInspectionFlowEvent({
        event: "inspection_start_requested",
        screen: "inspection_start",
        sessionId,
      });
      setIsLoading(true);
      setAgentMessage("");
      agentUtteranceRef.current = "";
      greetingTargetMessageRef.current = "";
      updateGreetingDisplayMessage("");
      setErrorMessage(null);
      setIsComplete(false);
      setLocalVideoTrack(null);
      setObservationTranscript("");
      clearGreetingFinishTimer();
      clearGreetingWordTimer();
      clearCameraFrameJudgeTimer();
      clearCompletionRedirectTimer();
      resolveCompletionSpeechWait("inspection_restart");
      resetFrameJudgementGate();
      greetingGateRef.current = createInspectionGreetingGate();
      hasRequestedInspectionCompletionRef.current = false;
      initialStepInstructionSentRef.current = false;
      setIsGreetingActive(true);

      try {
        const [jockeyProfile, voiceConfig] = await Promise.all([
          getCachedProfile().catch(() => null),
          getVoiceConfig(),
        ]);
        logInspectionFlowEvent({
          event: "voice_config_loaded",
          payload: {
            isReady: voiceConfig.ready,
            languageCode: jockeyProfile?.languageCode ?? null,
            missing: voiceConfig.missing,
            provider: voiceConfig.provider,
            transport: voiceConfig.transport,
          },
          screen: "inspection_start",
          sessionId,
        });
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
        logInspectionFlowEvent({
          event: "inspection_session_started",
          payload: {
            activeStep: startedSession.activeStep
              ? {
                  fieldName: startedSession.activeStep.fieldName,
                  id: startedSession.activeStep.id,
                  kind: startedSession.activeStep.kind,
                  status: startedSession.activeStep.status,
                }
              : null,
            agentMessage: startedSession.agentMessage,
            sessionStatus: startedSession.session.status,
          },
          screen: "inspection_start",
          sessionId,
          stepId: startedSession.activeStep?.id,
        });
      } catch (error) {
        if (mounted) {
          setErrorMessage(getInspectionErrorMessage(error));
        }
        logInspectionFlowEvent({
          event: "inspection_start_failed",
          payload: { error: getInspectionErrorMessage(error) },
          screen: "inspection_start",
          sessionId,
        });
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
      clearCompletionRedirectTimer();
      resolveCompletionSpeechWait("screen_cleanup");
      resetFrameJudgementGate();
      void voiceDriver.disconnect();
    };
  }, [
    clearCameraFrameJudgeTimer,
    clearCompletionRedirectTimer,
    clearGreetingFinishTimer,
    clearGreetingWordTimer,
    resetFrameJudgementGate,
    resolveCompletionSpeechWait,
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
    if (activeStep?.status === "needs_observation") {
      setObservationTranscript(stepMedia?.observationTranscript ?? "");
      return;
    }
    setObservationTranscript("");
  }, [
    activeStep,
    clearCameraFrameJudgeTimer,
    resetFrameJudgementGate,
    stepMedia?.observationTranscript,
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
        logInspectionFlowEvent({
          event: "camera_start_waiting",
          payload: {
            blockers,
            hasVideoTrack: Boolean(localVideoTrack),
          },
          screen: "realtime_camera",
          sessionId,
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
      logInspectionFlowEvent({
        event: "camera_start_instruction_sent",
        payload: {
          content: startEvent,
          hasVideoTrack: Boolean(localVideoTrack),
        },
        screen: "realtime_camera",
        sessionId,
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
        logInspectionFlowEvent({
          event: "camera_start_instruction_failed",
          payload: { error: getInspectionErrorMessage(error) },
          screen: "realtime_camera",
          sessionId,
          stepId: activeStep.id,
        });
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
    sessionId,
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
    const stepEvent = getInspectionStepChangedEvent(
      activeStep,
      Math.max(0, activeStepIndex),
    );

    let isCancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const sendStepEventWhenAgentIdle = () => {
      if (isCancelled) {
        return;
      }

      if (
        isAgentSpeakingRef.current ||
        activeAgentProcessingPhasesRef.current.size > 0
      ) {
        retryTimer = setTimeout(sendStepEventWhenAgentIdle, 180);
        return;
      }

      logInspectionFlowEvent({
        event: "step_changed_sent",
        payload: { content: stepEvent },
        screen: visibleScreen,
        sessionId,
        stepId: activeStep.id,
      });
      void voiceDriver.sendControlEvent(stepEvent).catch((error) => {
        initialStepInstructionSentRef.current = false;
        logInspectionFlowEvent({
          event: "step_changed_failed",
          payload: {
            content: stepEvent,
            error: getInspectionErrorMessage(error),
          },
          screen: visibleScreen,
          sessionId,
          stepId: activeStep.id,
        });
        setErrorMessage(getInspectionErrorMessage(error));
      });
    };

    retryTimer = setTimeout(sendStepEventWhenAgentIdle, 120);

    return () => {
      isCancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [
    activeStep,
    isGreetingActive,
    isLoading,
    isRealtimeCameraStep,
    session,
    sessionId,
    visibleScreen,
    voiceDriver,
  ]);

  useEffect(() => {
    if (
      !session ||
      session.status !== "ready_for_submission" ||
      isComplete ||
      hasRequestedInspectionCompletionRef.current
    ) {
      return;
    }

    hasRequestedInspectionCompletionRef.current = true;
    let isCancelled = false;
    const completionStepId = activeStepRef.current?.id;

    async function finishReadyInspection() {
      setIsBusy(true);
      setErrorMessage(null);
      logInspectionFlowEvent({
        event: "inspection_completion_requested",
        screen: visibleScreen,
        sessionId,
        stepId: completionStepId,
      });

      try {
        const completed = await completeInspectionSession(sessionId);
        logInspectionFlowEvent({
          event: "inspection_completed",
          payload: {
            agentMessage: completed.agentMessage,
            completedStepCount: completed.completedStepCount,
            status: completed.status,
          },
          screen: visibleScreen,
          sessionId,
          stepId: completionStepId,
        });
        await waitForAgentIdle();
        if (isCancelled) {
          return;
        }
        const completionSpeechFinished = startCompletionSpeechWait();
        await voiceDriver.sendControlEvent(
          [
            "INSPECTION_COMPLETED.",
            `Status: ${completed.status}.`,
            `Completed steps: ${completed.completedStepCount}.`,
            "Thank the jockey in your own short words.",
          ].join(" "),
        ).catch((error) => {
          resolveCompletionSpeechWait("completion_send_failed");
          throw error;
        });
        await completionSpeechFinished;

        if (isCancelled) {
          return;
        }
        setIsComplete(true);
        clearCompletionRedirectTimer();
        completionRedirectTimerRef.current = setTimeout(() => {
          completionRedirectTimerRef.current = null;
          router.replace("/" as never);
        }, COMPLETION_NAVIGATION_DWELL_MS);
      } catch (error) {
        logInspectionFlowEvent({
          event: "inspection_completion_failed",
          payload: { error: getInspectionErrorMessage(error) },
          screen: visibleScreen,
          sessionId,
          stepId: completionStepId,
        });
        if (!isCancelled) {
          hasRequestedInspectionCompletionRef.current = false;
          setErrorMessage(getInspectionErrorMessage(error));
        }
      } finally {
        if (!isCancelled) {
          setIsBusy(false);
        }
      }
    }

    void finishReadyInspection();

    return () => {
      isCancelled = true;
    };
  }, [
    clearCompletionRedirectTimer,
    isComplete,
    resolveCompletionSpeechWait,
    session,
    sessionId,
    startCompletionSpeechWait,
    visibleScreen,
    voiceDriver,
    waitForAgentIdle,
  ]);

  async function handleAnalyzeFrame() {
    if (!activeStep || !currentFrame || isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    logInspectionFlowEvent({
      event: "sample_frame_analysis_requested",
      payload: {
        frameKey: currentFrame.key,
        stepFieldName: activeStep.fieldName,
      },
      screen: visibleScreen,
      sessionId,
      stepId: activeStep.id,
    });

    try {
      const result = await analyzeLiveFrame({
        sampleKey: currentFrame.key,
        sessionId,
        stepId: activeStep.id,
      });
      setAnalysis(result);
      logInspectionFlowEvent({
        event: "sample_frame_analysis_received",
        payload: {
          frameKey: currentFrame.key,
          result,
        },
        screen: visibleScreen,
        sessionId,
        stepId: activeStep.id,
      });

      if (result.readyToCapture) {
        setTimeout(() => {
          void handleAutoCapture(activeStep, currentFrame.key);
        }, activeStep.autoCapture?.holdMs ?? 900);
      } else {
        setIsBusy(false);
      }
    } catch (error) {
      logInspectionFlowEvent({
        event: "sample_frame_analysis_failed",
        payload: {
          error: getInspectionErrorMessage(error),
          frameKey: currentFrame.key,
        },
        screen: visibleScreen,
        sessionId,
        stepId: activeStep.id,
      });
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
    logInspectionFlowEvent({
      event: "sample_auto_capture_started",
      payload: { sampleKey },
      screen: visibleScreen,
      sessionId,
      stepId: step.id,
    });

    try {
      const evidence = await savePhotoEvidence({
        localUri: `capture://${sampleKey}`,
        sampleKey,
        sessionId,
        stepId: step.id,
      });
      setSession(evidence.session);
      logInspectionFlowEvent({
        event: "photo_evidence_saved",
        payload: {
          accepted: evidence.accepted,
          agentMessage: evidence.agentMessage,
          completedStepId: evidence.completedStepId,
          evidenceId: evidence.evidenceId,
          nextStepId: evidence.nextStep?.id ?? null,
          sampleKey,
        },
        screen: visibleScreen,
        sessionId,
        stepId: step.id,
      });
    } catch (error) {
      logInspectionFlowEvent({
        event: "photo_evidence_save_failed",
        payload: {
          error: getInspectionErrorMessage(error),
          sampleKey,
        },
        screen: visibleScreen,
        sessionId,
        stepId: step.id,
      });
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
        logInspectionFlowEvent({
          event: "realtime_capture_ignored",
          payload: {
            activeStepId: step?.id ?? null,
            isBusy: isBusyRef.current,
            requestedStepId: stepId,
          },
          screen: "realtime_camera",
          sessionId,
          stepId,
        });
        return;
      }
      if (!localVideoTrack) {
        logInspectionFlowEvent({
          event: "realtime_capture_failed",
          payload: { error: "Realtime camera track is not ready." },
          screen: "realtime_camera",
          sessionId,
          stepId,
        });
        setErrorMessage("Realtime camera track is not ready.");
        return;
      }
      if (realtimeVideoViewTagRef.current === null) {
        logInspectionFlowEvent({
          event: "realtime_capture_failed",
          payload: { error: "Realtime camera view is not ready." },
          screen: "realtime_camera",
          sessionId,
          stepId,
        });
        setErrorMessage("Realtime camera view is not ready.");
        return;
      }

      isBusyRef.current = true;
      setIsBusy(true);
      setErrorMessage(null);
      logInspectionFlowEvent({
        event: "realtime_capture_started",
        payload: {
          viewTag: realtimeVideoViewTagRef.current,
        },
        screen: "realtime_camera",
        sessionId,
        stepId,
      });

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
        logInspectionFlowEvent({
          event: "realtime_frame_stored",
          payload: {
            bytes: capture.bytes,
            height: capture.height,
            mimeType: capture.mimeType,
            uri: capture.uri,
            width: capture.width,
          },
          screen: "realtime_camera",
          sessionId,
          stepId,
        });

        if (activeStepRef.current?.id !== stepId) {
          logInspectionFlowEvent({
            event: "realtime_capture_cancelled",
            payload: {
              activeStepId: activeStepRef.current?.id ?? null,
              requestedStepId: stepId,
            },
            screen: "realtime_camera",
            sessionId,
            stepId,
          });
          return;
        }

        const reviewEvent = getCapturedPhotoReviewEvent(step);
        setAgentMessage("Reviewing captured photo...");
        isFrameJudgementInFlightRef.current = true;
        clearCameraFrameJudgeReleaseTimer();
        await voiceDriver.sendControlEvent(reviewEvent, {
          imageDataUrl: capture.dataUrl,
          sourceUri: capture.uri,
          stepId,
        });
        logInspectionFlowEvent({
          event: "captured_photo_review_sent",
          payload: {
            bytes: capture.bytes,
            content: reviewEvent,
            height: capture.height,
            localUri: capture.uri,
            width: capture.width,
          },
          screen: "realtime_camera",
          sessionId,
          stepId,
        });
      } catch (error) {
        logInspectionScreen("capture-frame:error", getInspectionErrorMessage(error));
        logInspectionFlowEvent({
          event: "realtime_capture_failed",
          payload: { error: getInspectionErrorMessage(error) },
          screen: "realtime_camera",
          sessionId,
          stepId,
        });
        setErrorMessage(getInspectionErrorMessage(error));
      } finally {
        setAnalysis(null);
        setIsBusy(false);
        isBusyRef.current = false;
      }
    },
    [
      clearCameraFrameJudgeReleaseTimer,
      localVideoTrack,
      playCaptureFlash,
      sessionId,
      voiceDriver,
    ],
  );

  const handleRealtimeVideoViewReady = useCallback(
    (viewTag: number | null) => {
      realtimeVideoViewTagRef.current = viewTag;
      logInspectionScreen("camera-view-ready", { viewTag });
      logInspectionFlowEvent({
        event: "camera_view_ready",
        payload: { viewTag },
        screen: "realtime_camera",
        sessionId,
        stepId: activeStepRef.current?.id,
      });
    },
    [sessionId],
  );

  function handleUseNextFrame() {
    if (!stepMedia) {
      return;
    }

    setAnalysis(null);
    logInspectionFlowEvent({
      event: "sample_frame_advanced",
      payload: {
        fromFrameIndex: frameIndex,
        toFrameIndex: Math.min(frameIndex + 1, stepMedia.frames.length - 1),
      },
      screen: visibleScreen,
      sessionId,
      stepId: activeStep?.id,
    });
    setFrameIndex((current) =>
      Math.min(current + 1, stepMedia.frames.length - 1),
    );
  }

  function handleSelectObservationTranscript(transcript: string) {
    setObservationTranscript(transcript);
    logInspectionFlowEvent({
      event: "observation_transcript_selected",
      payload: { transcript },
      screen: "needs_observation",
      sessionId,
      stepId: activeStep?.id,
    });
  }

  async function handleObservationAnswer() {
    const transcript = observationTranscript.trim();
    if (!activeStep || !transcript || isBusy) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    logInspectionFlowEvent({
      event: "observation_submitted",
      payload: { transcript },
      screen: "needs_observation",
      sessionId,
      stepId: activeStep.id,
    });

    try {
      const observation = await structureObservation({
        sessionId,
        stepId: activeStep.id,
        transcript,
      });
      setSession(observation.session);
      setObservationTranscript("");
      logInspectionFlowEvent({
        event: "observation_structured",
        payload: {
          nextStepId: observation.nextStep?.id ?? null,
          observationId: observation.observationId,
          structuredFields: observation.structuredFields,
          summary: observation.summary,
          transcript,
        },
        screen: "needs_observation",
        sessionId,
        stepId: activeStep.id,
      });
    } catch (error) {
      logInspectionFlowEvent({
        event: "observation_structure_failed",
        payload: {
          error: getInspectionErrorMessage(error),
          transcript,
        },
        screen: "needs_observation",
        sessionId,
        stepId: activeStep.id,
      });
      setErrorMessage(getInspectionErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleEngineSubmit(answers: EngineQnaAnswers) {
    if (!activeStep || isBusy) {
      return;
    }

    const transcript = getEngineAnswerTranscript(answers);
    setIsBusy(true);
    setErrorMessage(null);
    logInspectionFlowEvent({
      event: "engine_answer_submitted",
      payload: {
        answers,
        phase: "final",
        transcript,
      },
      screen: "engine_guided",
      sessionId,
      stepId: activeStep.id,
    });

    try {
      const engine = await runEngineCheck({
        answers,
        phase: "final",
        sessionId,
        stepId: activeStep.id,
      });
      if (engine.session) {
        setSession(engine.session);
      }
      logInspectionFlowEvent({
        event: "engine_answer_structured",
        payload: {
          agentMessage: engine.agentMessage,
          isComplete: engine.isComplete,
          nextPhase: engine.nextPhase,
          phase: engine.phase,
          questions: engine.questions,
          structuredFields: engine.structuredFields,
          transcript,
        },
        screen: "engine_guided",
        sessionId,
        stepId: activeStep.id,
      });
    } catch (error) {
      logInspectionFlowEvent({
        event: "engine_answer_failed",
        payload: { error: getInspectionErrorMessage(error) },
        screen: "engine_guided",
        sessionId,
        stepId: activeStep.id,
      });
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

  if (activeStep?.status === "needs_observation") {
    return (
      <NeedsObservationScreen
        bottomInset={insets.bottom}
        errorMessage={errorMessage}
        frame={currentFrame}
        isBusy={isBusy}
        message={agentMessage}
        onConfirm={handleObservationAnswer}
        onSelectTranscript={handleSelectObservationTranscript}
        progressSteps={progressSteps}
        registrationNumber={session.vehicle.registrationNumber}
        step={activeStep}
        topInset={insets.top}
        transcript={observationTranscript}
        vehicleTitle={vehicleTitle}
      />
    );
  }

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
        instruction={agentMessage}
        isBusy={isBusy}
        onCapturePhoto={() => {
          void handleRealtimeCapture(activeStep.id);
        }}
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
