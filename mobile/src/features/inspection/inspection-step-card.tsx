import { Text } from "react-native";

import type { InspectionStep } from "@/src/api/client";
import { Card, typography } from "@/src/components/ui";

type InspectionStepCardProps = {
  step: InspectionStep;
};

export function InspectionStepCard({ step }: InspectionStepCardProps) {
  return (
    <Card>
      <Text selectable style={typography.eyebrow}>
        {step.section}
      </Text>
      <Text selectable style={typography.title}>
        {step.fieldName}
      </Text>
      <Text selectable style={typography.subtitle}>
        {step.instructions}
      </Text>
    </Card>
  );
}
