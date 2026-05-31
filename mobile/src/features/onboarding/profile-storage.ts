import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  isSavedJockeyProfile,
  type SavedJockeyProfile,
} from "@/src/features/onboarding/profile";

const PROFILE_CACHE_KEY = "inspection-copilot.profile.v1";

export async function getCachedProfile(): Promise<SavedJockeyProfile | null> {
  const rawValue = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
  if (rawValue === null) {
    return null;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    if (isSavedJockeyProfile(parsedValue)) {
      return parsedValue;
    }
  } catch {
    // Invalid local cache should never block the demo startup flow.
  }

  await clearCachedProfile();
  return null;
}

export async function saveCachedProfile(profile: SavedJockeyProfile) {
  await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
}

export async function clearCachedProfile() {
  await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
}
