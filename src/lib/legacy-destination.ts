import type { Destination } from "@/lib/types";

const LEGACY_REGION_IDS: readonly Destination[] = [
  "orlando",
  "paris",
  "tokyo",
  "cali",
  "cruise",
];

/** Map a `regions.id` to the legacy `trips.destination` enum for backwards compatibility. */
export function legacyDestinationFromRegionId(regionId: string): Destination {
  return LEGACY_REGION_IDS.includes(regionId as Destination)
    ? (regionId as Destination)
    : "custom";
}
