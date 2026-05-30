import {
  buildApiUrl,
  type InspectionReportMetadata,
  type VehicleProfile,
} from "@/src/api/client";
import {
  getSavedInspectionReports,
  saveInspectionReport,
  toReportCardViewModel,
} from "@/src/features/reports/report-storage";

export async function reportListContract() {
  const report: InspectionReportMetadata = {
    completionScore: 1,
    createdAt: "2026-05-30T10:00:00Z",
    downloadUrl: "/sessions/insp_demo/report.html",
    mediaQualityScore: 0.93,
    pricingRisk: "low",
    reportHtmlUrl: "/sessions/insp_demo/report.html",
    reportId: "rpt_demo",
    reportJsonUrl: "/sessions/insp_demo/report",
    sessionId: "insp_demo",
    status: "ready",
    updatedAt: "2026-05-30T10:00:00Z",
  };
  const vehicle: VehicleProfile = {
    bodyType: "SUV",
    fuelType: "Petrol",
    make: "Hyundai",
    model: "Creta",
    registrationCity: "Bengaluru",
    registrationNumber: "KA03MX2147",
    registrationState: "Karnataka",
    transmission: "Automatic",
    variant: "SX",
    year: 2020,
  };

  await saveInspectionReport({
    createdByName: "Aditya",
    createdByProfileId: "profile_demo",
    report,
    savedAt: "2026-05-30T10:01:00Z",
    vehicle,
  });

  const [savedReport] = await getSavedInspectionReports("profile_demo");
  const card = toReportCardViewModel(savedReport);

  if (!card.openUrl.endsWith("/sessions/insp_demo/report.html?view=1")) {
    throw new Error("Report cards should open inline report details.");
  }

  return buildApiUrl(card.downloadUrl);
}
