import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  InspectionReportMetadata,
  VehicleProfile,
} from "@/src/api/client";

const REPORT_CACHE_KEY = "jockey-copilot.reports.v1";

export type SavedInspectionReport = InspectionReportMetadata & {
  createdByName?: string;
  createdByProfileId?: string;
  savedAt: string;
  vehicle: VehicleProfile;
};

export type SaveInspectionReportRequest = {
  createdByName?: string;
  createdByProfileId?: string;
  report: InspectionReportMetadata;
  savedAt?: string;
  vehicle: VehicleProfile;
};

export type ReportCardViewModel = {
  badgeTone: "success" | "warning" | "danger";
  completedLabel: string;
  downloadUrl: string;
  mediaLabel: string;
  openUrl: string;
  pricingRiskLabel: string;
  reportId: string;
  savedAtLabel: string;
  sessionId: string;
  statusLabel: string;
  vehicleLabel: string;
  vehicleMetaLabel: string;
};

function isStringMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVehicleProfile(value: unknown): value is VehicleProfile {
  return (
    isStringMap(value) &&
    typeof value.registrationNumber === "string" &&
    typeof value.make === "string" &&
    typeof value.model === "string" &&
    typeof value.variant === "string" &&
    typeof value.fuelType === "string" &&
    typeof value.transmission === "string" &&
    typeof value.bodyType === "string" &&
    typeof value.registrationCity === "string" &&
    typeof value.registrationState === "string" &&
    typeof value.year === "number"
  );
}

function isSavedInspectionReport(value: unknown): value is SavedInspectionReport {
  return (
    isStringMap(value) &&
    typeof value.reportId === "string" &&
    typeof value.sessionId === "string" &&
    typeof value.status === "string" &&
    typeof value.completionScore === "number" &&
    typeof value.mediaQualityScore === "number" &&
    typeof value.pricingRisk === "string" &&
    typeof value.reportJsonUrl === "string" &&
    typeof value.reportHtmlUrl === "string" &&
    typeof value.downloadUrl === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.savedAt === "string" &&
    isVehicleProfile(value.vehicle)
  );
}

async function readSavedReports(): Promise<SavedInspectionReport[]> {
  const rawValue = await AsyncStorage.getItem(REPORT_CACHE_KEY);
  if (rawValue === null) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);
    if (Array.isArray(parsedValue)) {
      return parsedValue
        .filter(isSavedInspectionReport)
        .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
    }
  } catch {
    // Invalid local cache should not block report access.
  }

  await AsyncStorage.removeItem(REPORT_CACHE_KEY);
  return [];
}

export async function getSavedInspectionReports(
  profileId?: string,
): Promise<SavedInspectionReport[]> {
  const reports = await readSavedReports();
  if (!profileId) {
    return reports;
  }

  return reports.filter(
    (report) =>
      !report.createdByProfileId || report.createdByProfileId === profileId,
  );
}

export async function saveInspectionReport({
  createdByName,
  createdByProfileId,
  report,
  savedAt = new Date().toISOString(),
  vehicle,
}: SaveInspectionReportRequest) {
  const reports = await readSavedReports();
  const nextReport: SavedInspectionReport = {
    ...report,
    createdByName,
    createdByProfileId,
    savedAt,
    vehicle,
  };
  const withoutDuplicate = reports.filter(
    (item) =>
      item.reportId !== nextReport.reportId &&
      item.sessionId !== nextReport.sessionId,
  );
  const nextReports = [nextReport, ...withoutDuplicate].sort((left, right) =>
    right.savedAt.localeCompare(left.savedAt),
  );

  await AsyncStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(nextReports));
}

export function toReportCardViewModel(
  report: SavedInspectionReport,
): ReportCardViewModel {
  const vehicleLabel = `${report.vehicle.year} ${report.vehicle.make} ${report.vehicle.model}`;
  const pricingRiskLabel = titleCase(report.pricingRisk);
  const badgeTone =
    report.pricingRisk === "high"
      ? "danger"
      : report.pricingRisk === "low"
        ? "success"
        : "warning";

  return {
    badgeTone,
    completedLabel: `${Math.round(report.completionScore * 100)}%`,
    downloadUrl: report.downloadUrl,
    mediaLabel: report.mediaQualityScore.toFixed(2),
    openUrl: `${report.reportHtmlUrl}?view=1`,
    pricingRiskLabel,
    reportId: report.reportId,
    savedAtLabel: formatDateTime(report.savedAt),
    sessionId: report.sessionId,
    statusLabel: titleCase(report.status),
    vehicleLabel,
    vehicleMetaLabel: `${report.vehicle.registrationNumber} / ${report.vehicle.variant} / ${report.vehicle.fuelType}`,
  };
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

function titleCase(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
}
