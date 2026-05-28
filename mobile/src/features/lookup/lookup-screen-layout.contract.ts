import { LOOKUP_SCREEN_LAYOUT } from "@/src/features/lookup/vehicle-lookup-screen";
import { VEHICLE_FOUND_SCREEN_LAYOUT } from "@/src/features/lookup/vehicle-found-screen";

export function lookupScreenLayoutContract() {
  return {
    foundBody: VEHICLE_FOUND_SCREEN_LAYOUT.body,
    foundHero: VEHICLE_FOUND_SCREEN_LAYOUT.hero,
    lookup: LOOKUP_SCREEN_LAYOUT.mode,
  };
}
