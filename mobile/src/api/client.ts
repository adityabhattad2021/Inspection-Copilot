import {
  getInstructionLanguage,
  isInstructionLanguageCode,
  type InstructionLanguageCode,
  type SavedJockeyProfile,
} from "@/src/features/onboarding/profile";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8000";

type ApiErrorCode = "HTTP_ERROR" | "NETWORK_ERROR" | "INVALID_RESPONSE";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: ApiErrorCode,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type CreateProfileRequest = {
  name: string;
  languageCode: InstructionLanguageCode;
};

type ProfileResponse = {
  profileId: string;
  name: string;
  languageCode: string;
  languageLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type VehicleProfile = {
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  variant: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  registrationCity: string;
  registrationState: string;
};

export type AutoCaptureConfig = {
  enabled: boolean;
  holdMs: number;
};

export type InspectionStep = {
  id: string;
  fieldId: number;
  fieldName: string;
  section: string;
  kind: string;
  instructions: string;
  expectedParts: string[];
  status: string;
  autoCapture: AutoCaptureConfig | null;
};

export type InspectionPlan = {
  name: string;
  steps: InspectionStep[];
};

export type InspectionSession = {
  sessionId: string;
  status: string;
  vehicle: VehicleProfile;
  plan: InspectionPlan;
  createdAt: string;
  updatedAt: string;
};

export type StartInspectionSessionResponse = {
  session: InspectionSession;
  activeStep: InspectionStep | null;
  agentMessage: string;
};

export type LiveFrameAnalysis = {
  status: "adjust" | "hold";
  guidance: string;
  readyToCapture: boolean;
  confidence: number;
  visibleParts: string[];
  problems: string[];
};

export type PhotoEvidenceResponse = {
  evidenceId: string;
  accepted: boolean;
  completedStepId: string;
  nextStep: InspectionStep | null;
  agentMessage: string;
  session: InspectionSession;
};

export type StructureObservationResponse = {
  observationId: string;
  summary: string;
  structuredFields: Record<string, boolean | number | string>;
  nextStep: InspectionStep | null;
  session: InspectionSession;
};

export type EngineCheckResponse = {
  phase: string;
  nextPhase: string | null;
  agentMessage: string;
  questions: string[];
  isComplete: boolean;
  structuredFields: Record<string, boolean | number | string>;
  session: InspectionSession | null;
};

export type CompleteInspectionSessionResponse = {
  sessionId: string;
  status: string;
  completedStepCount: number;
  agentMessage: string;
};

async function requestJson<TResponse>(
  path: string,
  options?: RequestInit,
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => undefined);
    const message =
      typeof errorPayload?.detail === "string"
        ? errorPayload.detail
        : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status, "HTTP_ERROR");
  }

  return response.json() as Promise<TResponse>;
}

function toSavedJockeyProfile(payload: ProfileResponse): SavedJockeyProfile {
  if (!isInstructionLanguageCode(payload.languageCode)) {
    throw new ApiError(
      "Profile response used an unsupported instruction language",
      0,
      "INVALID_RESPONSE",
    );
  }

  const language = getInstructionLanguage(payload.languageCode);

  return {
    profileId: payload.profileId,
    jockeyName: payload.name,
    languageCode: payload.languageCode,
    languageLabel: payload.languageLabel || language.label,
    voiceLabel: language.voiceLabel,
  };
}

export async function createProfile(
  request: CreateProfileRequest,
): Promise<SavedJockeyProfile> {
  const payload = await requestJson<ProfileResponse>("/profiles", {
    body: JSON.stringify(request),
    method: "POST",
  });

  return toSavedJockeyProfile(payload);
}

export async function getProfile(
  profileId: string,
): Promise<SavedJockeyProfile> {
  const payload = await requestJson<ProfileResponse>(
    `/profiles/${encodeURIComponent(profileId)}`,
  );

  return toSavedJockeyProfile(payload);
}

export async function lookupVehicle(
  registrationNumber: string,
): Promise<VehicleProfile> {
  return requestJson<VehicleProfile>("/vehicles/lookup", {
    body: JSON.stringify({ registrationNumber }),
    method: "POST",
  });
}

export async function createInspectionSession(
  registrationNumber: string,
): Promise<InspectionSession> {
  return requestJson<InspectionSession>("/sessions", {
    body: JSON.stringify({ registrationNumber }),
    method: "POST",
  });
}

export async function getInspectionSession(
  sessionId: string,
): Promise<InspectionSession> {
  return requestJson<InspectionSession>(
    `/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export async function startInspectionSession(
  sessionId: string,
  request: { jockeyName?: string; languageCode?: string } = {},
): Promise<StartInspectionSessionResponse> {
  return requestJson<StartInspectionSessionResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/start`,
    {
      body: JSON.stringify(request),
      method: "POST",
    },
  );
}

export async function analyzeLiveFrame(request: {
  sessionId: string;
  stepId: string;
  sampleKey: string;
}): Promise<LiveFrameAnalysis> {
  return requestJson<LiveFrameAnalysis>("/ai/analyze-live-frame", {
    body: JSON.stringify(request),
    method: "POST",
  });
}

export async function savePhotoEvidence(request: {
  sessionId: string;
  stepId: string;
  sampleKey: string;
  localUri?: string;
}): Promise<PhotoEvidenceResponse> {
  return requestJson<PhotoEvidenceResponse>("/evidence/photo", {
    body: JSON.stringify(request),
    method: "POST",
  });
}

export async function structureObservation(request: {
  sessionId: string;
  stepId: string;
  transcript: string;
}): Promise<StructureObservationResponse> {
  return requestJson<StructureObservationResponse>("/ai/structure-observation", {
    body: JSON.stringify(request),
    method: "POST",
  });
}

export async function runEngineCheck(request: {
  sessionId: string;
  stepId: string;
  phase: string;
  transcript?: string;
}): Promise<EngineCheckResponse> {
  return requestJson<EngineCheckResponse>("/ai/engine-check", {
    body: JSON.stringify(request),
    method: "POST",
  });
}

export async function completeInspectionSession(
  sessionId: string,
): Promise<CompleteInspectionSessionResponse> {
  return requestJson<CompleteInspectionSessionResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/complete`,
    {
      method: "POST",
    },
  );
}
