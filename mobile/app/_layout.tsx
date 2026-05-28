import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";

import { colors } from "@/src/components/ui";

export default function RootLayout() {
  return (
    <>
      <StatusBar backgroundColor={colors.background} style="dark" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }} />
    </>
  );
}
