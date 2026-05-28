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
