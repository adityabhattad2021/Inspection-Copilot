import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, typography } from "@/src/components/ui";
import { VehicleModelViewer } from "@/src/features/lookup/vehicle-model-viewer";

export default function ModelTestRoute() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{
          backgroundColor: colors.background,
          flexGrow: 1,
          gap: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.lg,
        }}
        style={{ backgroundColor: colors.background }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={typography.eyebrow}>
            Android 3D spike
          </Text>
          <Text selectable style={[typography.title, { fontSize: 30 }]}>
            Kenney SUV GLB
          </Text>
          <Text selectable style={typography.subtitle}>
            Local CC0 model rendered through pinned Google model-viewer in
            WebView.
          </Text>
        </View>

        <VehicleModelViewer minHeight={420} />
      </ScrollView>
    </>
  );
}
