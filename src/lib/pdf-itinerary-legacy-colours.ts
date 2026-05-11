/**
 * Frozen saturated palette for PDF itinerary strips and read-only calendar preview.
 * Planner logged-in calendar uses soft pastels from `parks.bg_colour` / `fg_colour` (DB).
 *
 * Source: park seeds prior to `20260513120001_planner_calendar_pastel_park_colours.sql`
 * (TripTiles catalogue, May 2026).
 */

import type { Park } from "@/lib/types";

type Pair = { bg: string; fg: string };

/** Built-in park ids whose DB colours were switched to planner pastels — keep PDF/public preview on legacy hues. */
const LEGACY_ITINERARY_STRIP: Record<string, Pair> = {
  mk: { bg: "#4B2E83", fg: "#F5D76E" },
  ep: { bg: "#1E88E5", fg: "#FFFFFF" },
  hs: { bg: "#8B0000", fg: "#F5D76E" },
  ak: { bg: "#2D5016", fg: "#F5E6A8" },
  bb: { bg: "#4A90D9", fg: "#FFFFFF" },
  tl: { bg: "#2E8B8B", fg: "#FFF4C2" },
  ds: { bg: "#D4725B", fg: "#FFFFFF" },
  us: { bg: "#003D82", fg: "#FFD700" },
  ioa: { bg: "#C2410C", fg: "#FFF4C2" },
  eu: { bg: "#6A0DAD", fg: "#F5D76E" },
  vb: { bg: "#D84315", fg: "#FFF4C2" },
  sw: { bg: "#006B9F", fg: "#FFFFFF" },
  bg: { bg: "#8B4513", fg: "#FFD700" },
  aq: { bg: "#00A8B5", fg: "#FFFFFF" },
  dc: { bg: "#008B8B", fg: "#FFFFFF" },
  ll: { bg: "#D7222C", fg: "#FFD700" },
  alton: { bg: "#E63946", fg: "#FFFFFF" },
  thorpe: { bg: "#003D82", fg: "#FFD700" },
  chess: { bg: "#2D5016", fg: "#F5E6A8" },
  legoukw: { bg: "#D7222C", fg: "#FFD700" },
  paultons: { bg: "#FF69B4", fg: "#FFFFFF" },
  bppb: { bg: "#E63946", fg: "#FFFFFF" },
};

export function pdfItineraryStripColours(park: Park): Pair {
  if (park.is_custom) {
    return { bg: park.bg_colour, fg: park.fg_colour };
  }
  const row = LEGACY_ITINERARY_STRIP[park.id];
  if (row) return row;
  return { bg: park.bg_colour, fg: park.fg_colour };
}
