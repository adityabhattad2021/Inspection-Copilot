import {
  getVehicleModelViewerHtml,
  VEHICLE_MODEL_FILE_NAME,
} from "@/src/features/lookup/vehicle-model-html";

export function vehicleModelViewerContract() {
  const html = getVehicleModelViewerHtml();

  return {
    htmlIncludesModelViewer: html.includes("<model-viewer"),
    modelFileName: VEHICLE_MODEL_FILE_NAME,
  };
}
