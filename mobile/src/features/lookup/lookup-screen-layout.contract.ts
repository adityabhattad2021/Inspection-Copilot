import { LOOKUP_SCREEN_LAYOUT } from "@/src/features/lookup/vehicle-lookup-screen";
import { VEHICLE_FOUND_SCREEN_LAYOUT } from "@/src/features/lookup/vehicle-found-screen";

export function lookupScreenLayoutContract() {
  return {
    foundBody: VEHICLE_FOUND_SCREEN_LAYOUT.body,
    foundModelAnimationTopology: VEHICLE_FOUND_SCREEN_LAYOUT.animationTopology,
    foundHero: VEHICLE_FOUND_SCREEN_LAYOUT.hero,
    foundModelAnimation: VEHICLE_FOUND_SCREEN_LAYOUT.modelAnimation,
    foundRegistrationPlate: VEHICLE_FOUND_SCREEN_LAYOUT.registrationPlate,
    lookupInput: LOOKUP_SCREEN_LAYOUT.input,
    lookup: LOOKUP_SCREEN_LAYOUT.mode,
  };
}
