import {
  ENGINE_CHECK_PHASES,
  ENGINE_SCREEN_COPY,
  advanceEngineGuidedState,
  createInitialEngineGuidedState,
  getCurrentEnginePhase,
  getEngineAnswerTranscript,
  recordEngineQuestionAnswer,
  type EngineGuidedPhaseId,
  type EngineQnaAnswers,
} from "@/src/features/inspection/engine-guided-check";

const expectedPhaseOrder: readonly EngineGuidedPhaseId[] = [
  "prep",
  "idle",
  "rev",
  "exhaust",
];

if (ENGINE_CHECK_PHASES.length !== expectedPhaseOrder.length) {
  throw new Error("Engine check should stay a focused four-phase demo flow.");
}

if (ENGINE_SCREEN_COPY.title !== "Engine inspection") {
  throw new Error("Engine screen title should stay engine-specific.");
}

export function engineGuidedCheckFlowContract(): EngineQnaAnswers {
  let state = createInitialEngineGuidedState();

  if (getCurrentEnginePhase(state).id !== "prep") {
    throw new Error("Engine check should begin with setup instructions.");
  }

  state = advanceEngineGuidedState(state);
  if (getCurrentEnginePhase(state).id !== "idle" || state.mode !== "instruction") {
    throw new Error("Idle Q&A should follow the prep instruction.");
  }

  state = advanceEngineGuidedState(state);
  if (getCurrentEnginePhase(state).id !== "idle" || state.mode !== "question") {
    throw new Error("Idle question should be asked after the idle check is done.");
  }

  state = recordEngineQuestionAnswer(state, "no");
  state = advanceEngineGuidedState(state);
  if (getCurrentEnginePhase(state).id !== "rev" || state.mode !== "instruction") {
    throw new Error("Rev Q&A should follow idle Q&A.");
  }

  state = advanceEngineGuidedState(state);
  if (getCurrentEnginePhase(state).id !== "rev" || state.mode !== "question") {
    throw new Error("Rev question should be asked after the rev check is done.");
  }

  state = recordEngineQuestionAnswer(state, "mild");
  state = advanceEngineGuidedState(state);
  if (getCurrentEnginePhase(state).id !== "exhaust" || state.mode !== "instruction") {
    throw new Error("Exhaust Q&A should follow rev Q&A.");
  }

  state = advanceEngineGuidedState(state);
  if (getCurrentEnginePhase(state).id !== "exhaust" || state.mode !== "question") {
    throw new Error("Exhaust question should be asked after the exhaust check is done.");
  }

  state = recordEngineQuestionAnswer(state, "normal");
  const transcript = getEngineAnswerTranscript(state.answers);

  if (!transcript.includes("Knocking: no.")) {
    throw new Error("Engine transcript should preserve recorded answers.");
  }

  return state.answers;
}
