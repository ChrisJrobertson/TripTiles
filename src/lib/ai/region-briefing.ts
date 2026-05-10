import { parkMatchesPlannerRegion } from "@/lib/park-matches-planner-region";
import type { Park, Region, RegionDataQualityTier } from "@/lib/types";

function tierGuidance(tier: RegionDataQualityTier | undefined): string {
  if (tier === "deep") {
    return "You have rich park metadata and catalogue listings for this region — give confident, specific planning text where the catalogue supports it.";
  }
  if (tier === "standard") {
    return "You have park names and regional context — stay accurate to what appears in the park list; avoid inventing attractions not implied by the catalogue.";
  }
  return "Data quality is LIGHT: you have park/tile names but do not assume detailed ride-level knowledge. Stay general — do not invent specific rides, lands, or restaurants not shown in the catalogue. Prefer date- and group-aware phrasing over venue specifics.";
}

/**
 * Authoritative region context prepended to Smart Plan / day-timeline / day-strategy user prompts.
 */
export function buildAiRegionBriefingBlock(
  region: Region,
  parks: Park[],
): string {
  const tier: RegionDataQualityTier = region.data_quality_tier ?? "light";
  const parksInRegion = parks.filter(
    (p) => !p.is_custom && parkMatchesPlannerRegion(p, region.id),
  );
  const parkNames = [
    ...new Set(parksInRegion.map((p) => p.name.trim())),
  ].filter(Boolean);
  const parksList =
    parkNames.length > 0
      ? parkNames.slice(0, 40).join(", ") +
        (parkNames.length > 40 ? ", …" : "")
      : "no built-in parks listed (custom tiles may still appear)";

  const disney = region.has_disney
    ? "This market includes Disney-style queue products where applicable."
    : "This market does not include Disney queue-skip products in TripTiles.";
  const universal = region.has_universal
    ? "Universal Express-style queue products may apply where applicable."
    : "No Universal Express-style queue products are flagged for this region.";

  const crowdTierLine =
    tier === "light"
      ? "For trip-wide crowd summaries and notes: write confident, helpful guidance from travel dates and party size — do NOT apologise for missing data or claim detailed crowd modelling you cannot verify. Do NOT use 'we have no data' phrasing."
      : tier === "standard"
        ? "Crowd notes may reference season and typical patterns; avoid fabricated precise indices."
        : "";

  return [
    "REGION BRIEFING (authoritative — follow in all narrative fields):",
    `Destination: ${region.name}, ${region.country}.`,
    `Catalogue park count in prompt: ${parksInRegion.length} (names: ${parksList}).`,
    disney,
    universal,
    `Planner data tier: ${tier}. ${tierGuidance(tier)}`,
    crowdTierLine,
  ]
    .filter(Boolean)
    .join("\n");
}
