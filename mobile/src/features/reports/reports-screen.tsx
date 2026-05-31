import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { buildApiUrl } from "@/src/api/client";
import {
  Button,
  Card,
  StatusPill,
  colors,
  spacing,
  typography,
} from "@/src/components/ui";
import { getCachedProfile } from "@/src/features/onboarding/profile-storage";
import {
  getSavedInspectionReports,
  toReportCardViewModel,
  type ReportCardViewModel,
} from "@/src/features/reports/report-storage";

type ReportsRouteParams = {
  sessionId?: string;
};

export function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { sessionId: highlightedSessionId } =
    useLocalSearchParams<ReportsRouteParams>();
  const [reports, setReports] = useState<ReportCardViewModel[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReports = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setErrorMessage(null);

    try {
      const profile = await getCachedProfile();
      const savedReports = await getSavedInspectionReports(profile?.profileId);
      setReports(savedReports.map(toReportCardViewModel));
    } catch {
      setErrorMessage("Unable to load saved reports.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReports("initial");
  }, [loadReports]);

  async function openReport(url: string) {
    void Haptics.selectionAsync();
    await WebBrowser.openBrowserAsync(buildApiUrl(url));
  }

  const highlightedReport =
    typeof highlightedSessionId === "string" ? highlightedSessionId : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: colors.background },
          title: "Reports",
        }}
      />
      <ScrollView
        contentContainerStyle={{
          backgroundColor: colors.background,
          flexGrow: 1,
          gap: spacing.md,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
        }}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            onRefresh={() => void loadReports("refresh")}
            refreshing={isRefreshing}
            tintColor={colors.camera}
          />
        }
        style={{ backgroundColor: colors.background }}
      >
        <View style={{ gap: spacing.xs }}>
          <Text selectable style={typography.eyebrow}>
            Inspector reports
          </Text>
          <Text selectable style={[typography.title, { fontSize: 30 }]}>
            My Reports
          </Text>
          <Text selectable style={typography.subtitle}>
            {reports.length} generated reports
          </Text>
        </View>

        {errorMessage ? (
          <Text selectable style={[typography.small, { color: colors.danger }]}>
            {errorMessage}
          </Text>
        ) : null}

        {isLoading ? (
          <Card style={{ alignItems: "center" }}>
            <ActivityIndicator color={colors.camera} />
            <Text selectable style={typography.small}>
              Loading reports
            </Text>
          </Card>
        ) : reports.length > 0 ? (
          reports.map((report) => (
            <ReportCard
              isHighlighted={report.sessionId === highlightedReport}
              key={report.reportId}
              onDownload={() => void openReport(report.downloadUrl)}
              onOpen={() => void openReport(report.openUrl)}
              report={report}
            />
          ))
        ) : (
          <Card>
            <Text selectable style={typography.title}>
              No reports saved yet
            </Text>
            <Text selectable style={typography.subtitle}>
              Complete an inspection to generate the first report.
            </Text>
            <Button label="Start inspection" onPress={() => router.push("/" as never)} />
          </Card>
        )}
      </ScrollView>
    </>
  );
}

type ReportCardProps = {
  isHighlighted: boolean;
  onDownload: () => void;
  onOpen: () => void;
  report: ReportCardViewModel;
};

function ReportCard({
  isHighlighted,
  onDownload,
  onOpen,
  report,
}: ReportCardProps) {
  return (
    <Card
      style={{
        borderColor: isHighlighted ? colors.aiText : colors.border,
        borderWidth: isHighlighted ? 1.5 : 1,
      }}
    >
      <View
        style={{
          alignItems: "flex-start",
          flexDirection: "row",
          gap: spacing.sm,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={typography.eyebrow}>
            {report.savedAtLabel}
          </Text>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.82}
            numberOfLines={2}
            selectable
            style={[typography.title, { fontSize: 22, lineHeight: 28 }]}
          >
            {report.vehicleLabel}
          </Text>
          <Text selectable style={typography.small}>
            {report.vehicleMetaLabel}
          </Text>
        </View>
        <StatusPill label={report.pricingRiskLabel} tone={report.badgeTone} />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        <Metric label="Completion" value={report.completedLabel} />
        <Metric label="Media" value={report.mediaLabel} />
        <Metric label="Status" value={report.statusLabel} />
      </View>

      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        <Button
          label="Open"
          onPress={onOpen}
          size="md"
          style={{ flex: 1 }}
        />
        <Button
          label="Download"
          onPress={onDownload}
          size="md"
          style={{ flex: 1 }}
          variant="secondary"
        />
      </View>
    </Card>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        gap: spacing.xxs,
        padding: spacing.sm,
      }}
    >
      <Text selectable style={typography.small}>
        {label}
      </Text>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        numberOfLines={1}
        selectable
        style={[typography.label, { fontSize: 15 }]}
      >
        {value}
      </Text>
    </View>
  );
}
