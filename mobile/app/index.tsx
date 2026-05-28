import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack, router } from "expo-router";

import { ApiError, getProfile } from "@/src/api/client";
import { colors, spacing, typography } from "@/src/components/ui";
import { VehicleLookupScreen } from "@/src/features/lookup/vehicle-lookup-screen";
import type { SavedJockeyProfile } from "@/src/features/onboarding/profile";
import {
  clearCachedProfile,
  getCachedProfile,
  saveCachedProfile,
} from "@/src/features/onboarding/profile-storage";

export default function Index() {
  const [profile, setProfile] = useState<SavedJockeyProfile | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const cachedProfile = await getCachedProfile();
      if (!mounted) {
        return;
      }

      if (cachedProfile === null) {
        router.replace("/onboarding" as never);
        return;
      }

      try {
        const freshProfile = await getProfile(cachedProfile.profileId);
        await saveCachedProfile(freshProfile);
        if (mounted) {
          setProfile(freshProfile);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          await clearCachedProfile();
          if (mounted) {
            router.replace("/onboarding" as never);
          }
          return;
        }

        if (mounted) {
          setProfile(cachedProfile);
        }
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {profile ? (
        <VehicleLookupScreen jockeyProfile={profile} />
      ) : (
        <ProfileLoadingState />
      )}
    </>
  );
}

function ProfileLoadingState() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.background,
        flex: 1,
        gap: spacing.md,
        justifyContent: "center",
        padding: spacing.lg,
      }}
    >
      <ActivityIndicator color={colors.camera} />
      <Text selectable style={[typography.small, { textAlign: "center" }]}>
        Loading jockey profile
      </Text>
    </View>
  );
}
