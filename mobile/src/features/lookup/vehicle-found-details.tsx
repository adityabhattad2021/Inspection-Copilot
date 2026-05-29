import { ActivityIndicator, Text, View } from "react-native";

import type { VehicleProfile } from "@/src/api/client";
import {
  StatusPill,
  colors,
  radius,
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
        gap: spacing.lg,
      }}
    >
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text selectable style={[typography.eyebrow, { color: colors.aiText }]}>
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
        <Text selectable style={typography.small}>
          Registration number
        </Text>
        <RegistrationPlateText
          style={{ maxWidth: 286 }}
          value={vehicle.registrationNumber}
        />
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
    <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
      <View
        style={{
          alignItems: "flex-start",
          flexDirection: "row",
          gap: spacing.md,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={typography.eyebrow}>
            Inspection plan
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={2}
            selectable
            style={[typography.title, { fontSize: 28, lineHeight: 34 }]}
          >
            Guided route selected
          </Text>
        </View>
        <StatusPill label="5 checks" tone="ai" />
      </View>
      <Text selectable style={typography.subtitle}>
        {vehicle.bodyType} {vehicle.fuelType} {vehicle.transmission} plan for{" "}
        {vehicle.registrationCity}, {vehicle.registrationState}.
      </Text>
      <PlanPreview />
    </View>
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
        backgroundColor: colors.aiSoft,
        borderColor: colors.ai,
        borderRadius: radius.pill,
        borderWidth: 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
      }}
    >
      <Text selectable style={[typography.small, { color: colors.aiText }]}>
        {label}
      </Text>
    </View>
  );
}

const planSteps = [
  {
    label: "Exterior",
    note: "Front and rear photo evidence",
  },
  {
    label: "Tyres",
    note: "Wheel, tread, and visible condition checks",
  },
  {
    label: "Interior",
    note: "Dashboard, odometer, and cabin proof",
  },
  {
    label: "Engine",
    note: "Guided sound, idle, and rev observations",
  },
  {
    label: "Report",
    note: "AI quality report and audit trail",
  },
] as const;

function PlanPreview() {
  const railLeft = 23;

  return (
    <View
      style={{
        minHeight: 360,
        paddingBottom: spacing.xs,
        paddingTop: spacing.xs,
        position: "relative",
      }}
    >
      <View
        style={{
          backgroundColor: colors.borderStrong,
          bottom: spacing.lg,
          left: railLeft,
          position: "absolute",
          top: spacing.lg,
          width: 2,
        }}
      />
      {planSteps.map((step, index) => {
        const isActive = index === 0;

        return (
          <View
            key={step.label}
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: spacing.md,
              minHeight: 68,
            }}
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                height: 68,
                justifyContent: "center",
                width: 54,
              }}
            >
              <View
                style={{
                  backgroundColor: isActive ? colors.ai : colors.background,
                  borderColor: isActive ? colors.aiText : colors.borderStrong,
                  borderRadius: radius.pill,
                  borderWidth: 2,
                  height: 20,
                  left: railLeft - 9,
                  position: "absolute",
                  width: 20,
                }}
              />
              <View
                style={{
                  backgroundColor: isActive ? colors.aiText : colors.borderStrong,
                  height: 2,
                  left: railLeft + 10,
                  position: "absolute",
                  width: 26,
                }}
              />
              <Text
                selectable
                style={[
                  typography.small,
                  {
                    color: isActive ? colors.aiText : colors.textMuted,
                    left: -spacing.xxs,
                    position: "absolute",
                    textAlign: "center",
                    width: 20,
                  },
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text
                selectable
                style={[
                  typography.title,
                  {
                    color: isActive ? colors.text : colors.textMuted,
                    fontSize: 19,
                    lineHeight: 25,
                  },
                ]}
              >
                {step.label}
              </Text>
              <Text selectable style={typography.small}>
                {step.note}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
