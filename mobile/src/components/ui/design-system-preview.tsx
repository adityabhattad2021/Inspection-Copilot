import { View } from "react-native";

import {
  Button,
  Card,
  ProgressRail,
  StatusPill,
  StepHeader,
} from "@/src/components/ui";

const previewSteps = [
  { id: "front-main", label: "Front", status: "complete" as const },
  { id: "rear-main", label: "Rear", status: "active" as const },
  { id: "engine", label: "Engine", status: "pending" as const },
];

export function DesignSystemPreview() {
  return (
    <Card>
      <View style={{ gap: 16 }}>
        <StepHeader
          eyebrow="Exterior & Tyres"
          title="Rear Main"
          description="Show the full rear bumper, boot line, and tail lamps."
          statusLabel="AI guiding"
          statusTone="ai"
        />
        <ProgressRail steps={previewSteps} />
        <StatusPill label="Frame ready" tone="success" />
        <Button label="Hold to capture" onPress={() => {}} />
      </View>
    </Card>
  );
}
