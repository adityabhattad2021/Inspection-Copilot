import { ActivityIndicator, Text, View } from "react-native";

import type { VehicleProfile } from "@/src/api/client";
import {
  Card,
  StatusPill,
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from "@/src/components/ui";
import { RegistrationPlateText } from "@/src/features/lookup/registration-plate";

type VehicleIdentityPanelProps = {
  vehicle: VehicleProfile;
};

export function VehicleIdentityPanel({ vehicle }: VehicleIdentityPanelProps) {
  return (
    <View
      style={{
        backgroundColor: colors.camera,
        borderColor: "rgba(215, 248, 92, 0.24)",
        borderCurve: "continuous",
        borderRadius: radius.md,
        borderWidth: 1,
        gap: spacing.lg,
        overflow: "hidden",
        padding: spacing.md,
        ...shadows.lift,
      }}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text selectable style={[typography.eyebrow, { color: colors.ai }]}>
          Identity lock
        </Text>
        <StatusPill label="Plan selected" tone="success" />
      </View>

      <View
        style={{
          alignItems: "center",
          gap: spacing.sm,
          justifyContent: "center",
          paddingVertical: spacing.sm,
        }}
      >
        <Text selectable style={[typography.small, { color: colors.textOnDark }]}>
          Registration number
        </Text>
        <RegistrationPlateText value={vehicle.registrationNumber} />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        <VehicleChip label={vehicle.variant} />
        <VehicleChip label={vehicle.fuelType} />
        <VehicleChip label={vehicle.transmission} />
        <VehicleChip label={vehicle.bodyType} />
      </View>
    </View>
  );
}

type InspectionPlanCardProps = {
  vehicle: VehicleProfile;
};

export function InspectionPlanCard({ vehicle }: InspectionPlanCardProps) {
  return (
    <Card>
      <Text selectable style={typography.label}>
        Inspection plan
      </Text>
      <Text selectable style={typography.subtitle}>
        {vehicle.bodyType} {vehicle.fuelType} {vehicle.transmission} plan
        selected for {vehicle.registrationCity}, {vehicle.registrationState}.
      </Text>
      <PlanPreview />
    </Card>
  );
}

export function VehicleFoundLoadingState() {
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
      <View
        style={{
          alignItems: "center",
          backgroundColor: colors.camera,
          borderColor: "rgba(215, 248, 92, 0.22)",
          borderCurve: "continuous",
          borderRadius: radius.md,
          borderWidth: 1,
          gap: spacing.md,
          justifyContent: "center",
          minHeight: 180,
          padding: spacing.xl,
          width: "100%",
        }}
      >
        <ActivityIndicator color={colors.ai} />
        <Text
          selectable
          style={[typography.label, { color: colors.textOnDark }]}
        >
          Matching vehicle profile
        </Text>
        <Text
          selectable
          style={[
            typography.small,
            { color: colors.textOnDark, textAlign: "center" },
          ]}
        >
          Selecting the right guided inspection plan.
        </Text>
      </View>
    </View>
  );
}

type VehicleChipProps = {
  label: string;
};

function VehicleChip({ label }: VehicleChipProps) {
  return (
    <View
      style={{
        backgroundColor: "rgba(215, 248, 92, 0.1)",
        borderColor: "rgba(215, 248, 92, 0.22)",
        borderRadius: radius.pill,
        borderWidth: 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
      }}
    >
      <Text selectable style={[typography.small, { color: colors.textOnDark }]}>
        {label}
      </Text>
    </View>
  );
}

function PlanPreview() {
  const steps = ["Exterior", "Tyres", "Interior", "Engine", "Report"];

  return (
    <View style={{ gap: spacing.xs }}>
      {steps.map((step, index) => (
        <View
          key={step}
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing.sm,
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: index === 0 ? colors.ai : colors.surfaceMuted,
              borderRadius: radius.pill,
              height: 24,
              justifyContent: "center",
              width: 24,
            }}
          >
            <Text
              selectable
              style={[
                typography.small,
                { color: index === 0 ? colors.aiText : colors.textMuted },
              ]}
            >
              {index + 1}
            </Text>
          </View>
          <Text selectable style={typography.label}>
            {step}
          </Text>
        </View>
      ))}
    </View>
  );
}
