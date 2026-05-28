import { ActivityIndicator, Text, View } from "react-native";

import { Card, colors, spacing, typography } from "@/src/components/ui";

type LoadingInspectionViewProps = {
  message: string;
};

type InspectionUnavailableViewProps = {
  message: string;
};

export function LoadingInspectionView({ message }: LoadingInspectionViewProps) {
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
        {message}
      </Text>
    </View>
  );
}

export function InspectionUnavailableView({
  message,
}: InspectionUnavailableViewProps) {
  return (
    <View
      style={{
        backgroundColor: colors.background,
        flex: 1,
        justifyContent: "center",
        padding: spacing.lg,
      }}
    >
      <Card>
        <Text selectable style={typography.title}>
          Inspection unavailable
        </Text>
        <Text selectable style={typography.subtitle}>
          {message}
        </Text>
      </Card>
    </View>
  );
}
