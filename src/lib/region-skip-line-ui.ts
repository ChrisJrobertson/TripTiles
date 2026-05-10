import type { Park, Region } from "@/lib/types";
import {
  regionHasDisneyQueueParks,
  regionHasUniversalQueueParks,
} from "@/lib/wizard-queue-step-region";

function flagDisney(region: Region | null | undefined): boolean | null {
  if (region == null) return null;
  if (typeof region.has_disney === "boolean") return region.has_disney;
  return null;
}

function flagUniversal(region: Region | null | undefined): boolean | null {
  if (region == null) return null;
  if (typeof region.has_universal === "boolean") return region.has_universal;
  return null;
}

function logMismatch(
  kind: string,
  regionKey: string,
  flag: boolean,
  catalogue: boolean,
) {
  if (process.env.NODE_ENV !== "development") return;
  if (flag === catalogue) return;
  console.warn(`[region-skip-line-ui] ${kind} flag/catalogue mismatch`, {
    regionId: regionKey,
    flag,
    catalogue,
  });
}

/** Disney LL / Genie+ style products in planner copy when DB flag is set; else catalogue fallback. */
export function regionHasDisneySkipProducts(
  region: Region | null | undefined,
  parks: Park[],
  regionId: string | null | undefined,
): boolean {
  const catalogue = regionHasDisneyQueueParks(parks, regionId ?? null);
  const fromFlag = flagDisney(region);
  const resolved = fromFlag !== null ? fromFlag : catalogue;
  if (fromFlag !== null) {
    logMismatch(
      "Disney",
      region?.id ?? String(regionId ?? ""),
      fromFlag,
      catalogue,
    );
  }
  return resolved;
}

/** Universal Express–style products when DB flag is set; else catalogue fallback. */
export function regionHasUniversalSkipProducts(
  region: Region | null | undefined,
  parks: Park[],
  regionId: string | null | undefined,
): boolean {
  const catalogue = regionHasUniversalQueueParks(parks, regionId ?? null);
  const fromFlag = flagUniversal(region);
  const resolved = fromFlag !== null ? fromFlag : catalogue;
  if (fromFlag !== null) {
    logMismatch(
      "Universal",
      region?.id ?? String(regionId ?? ""),
      fromFlag,
      catalogue,
    );
  }
  return resolved;
}

export function regionShowsSkipLineProducts(
  region: Region | null | undefined,
  parks: Park[],
  regionId: string | null | undefined,
): boolean {
  return (
    regionHasDisneySkipProducts(region, parks, regionId) ||
    regionHasUniversalSkipProducts(region, parks, regionId)
  );
}
