import { createProfile, getProfile } from "@/src/api/client";
import {
  clearCachedProfile,
  getCachedProfile,
  saveCachedProfile,
} from "@/src/features/onboarding/profile-storage";

export async function profilePersistenceContract() {
  const profile = await createProfile({
    name: "Aditya",
    languageCode: "en-IN",
  });

  await saveCachedProfile(profile);

  const cached = await getCachedProfile();
  if (cached?.profileId) {
    await getProfile(cached.profileId);
  }

  await clearCachedProfile();
}
