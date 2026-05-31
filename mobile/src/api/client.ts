import {
  getInstructionLanguage,
  isInstructionLanguageCode,
  type InstructionLanguageCode,
  type SavedInspectorProfile,
} from "@/src/features/onboarding/profile";

const LOCAL_API_BASE_URL = "http://localhost:8000";
const PRODUCTION_API_BASE_URL = "http://65.0.101.246";

function normalizeBaseUrl(url: string | undefined) {
  return url?.replace(/\/$/, "");
}

export const API_BASE_URL =
  __DEV__
    ? (normalizeBaseUrl(process.env.EXPO_PUBLIC_DEV_API_BASE_URL) ??
      LOCAL_API_BASE_URL)
    : (normalizeBaseUrl(process.env.EXPO_PUBLIC_RELEASE_API_BASE_URL) ??
      PRODUCTION_API_BASE_URL);

export function buildApiUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedPath = pathOrUrl.startsWith("/")
    ? pathOrUrl
    : `/${pathOrUrl}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

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

export type InspectionReportMetadata = {
  reportId: string;
  sessionId: string;
  status: string;
  completionScore: number;
  mediaQualityScore: number;
  pricingRisk: string;
  reportJsonUrl: string;
  reportHtmlUrl: string;
  downloadUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type CompleteInspectionSessionResponse = {
  sessionId: string;
  status: string;
  completedStepCount: number;
  agentMessage: string;
  report: InspectionReportMetadata;
};

export type VoiceRuntimeConfig = {
  provider: "pipecat";
  llmProvider: "gemini" | "openai";
  transport: "small-webrtc";
  startUrl: string;
  model: string;
  voice: string;
  ready: boolean;
  missing: string[];
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

async function requestFormJson<TResponse>(
  path: string,
  body: FormData,
): Promise<TResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      body,
      headers: {
        Accept: "application/json",
      },
      method: "POST",
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

function toSavedInspectorProfile(payload: ProfileResponse): SavedInspectorProfile {
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
    inspectorName: payload.name,
    languageCode: payload.languageCode,
    languageLabel: payload.languageLabel || language.label,
    voiceLabel: language.voiceLabel,
  };
}

export async function createProfile(
  request: CreateProfileRequest,
): Promise<SavedInspectorProfile> {
  const payload = await requestJson<ProfileResponse>("/profiles", {
    body: JSON.stringify(request),
    method: "POST",
  });

  return toSavedInspectorProfile(payload);
}

export async function getProfile(
  profileId: string,
): Promise<SavedInspectorProfile> {
  const payload = await requestJson<ProfileResponse>(
    `/profiles/${encodeURIComponent(profileId)}`,
  );

  return toSavedInspectorProfile(payload);
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

export async function getVoiceConfig(): Promise<VoiceRuntimeConfig> {
  return requestJson<VoiceRuntimeConfig>("/voice/config");
}

export async function startInspectionSession(
  sessionId: string,
  request: { inspectorName?: string; languageCode?: string } = {},
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
  image?: {
    name: string;
    type: "image/jpeg";
    uri: string;
  };
  sessionId: string;
  stepId: string;
  sampleKey: string;
  localUri?: string;
}): Promise<PhotoEvidenceResponse> {
  if (request.image) {
    const formData = new FormData();
    formData.append("sessionId", request.sessionId);
    formData.append("stepId", request.stepId);
    formData.append("sampleKey", request.sampleKey);
    if (request.localUri) {
      formData.append("localUri", request.localUri);
    }
    formData.append("image", request.image as unknown as Blob);

    return requestFormJson<PhotoEvidenceResponse>("/evidence/photo", formData);
  }

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
  answers?: Record<string, string>;
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
