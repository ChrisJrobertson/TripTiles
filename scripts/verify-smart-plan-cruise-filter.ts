/**
 * Repro: parksForPrompt for has_cruise=false (e.g. trip 08d55262-811c-44cc-89ef-a5c971f8e689, Orlando)
 * must NOT include cruise-only tiles, but MUST keep flyout/flyhome.
 *
 * Run: npx tsx scripts/verify-smart-plan-cruise-filter.ts
 */
import { requiresCruiseSegment } from "../src/lib/ai-plan-guardrails";
import type { Park } from "../src/lib/types";

function p(
  o: Pick<Park, "id" | "name" | "park_group" | "sort_order">,
): Park {
  return {
    ...o,
    icon: null,
    bg_colour: "#000",
    fg_colour: "#fff",
    destinations: [],
    region_ids: ["orlando"],
    is_custom: false,
  };
}

/** Mirrors runGenerateAIPlan: builtInParks from region, has_cruise=false. */
const builtInParks: Park[] = [
  p({
    id: "flyout",
    name: "Fly Out / Arrive",
    park_group: "travel",
    sort_order: 1,
  }),
  p({
    id: "flyhome",
    name: "Fly Home / Depart",
    park_group: "travel",
    sort_order: 2,
  }),
  p({
    id: "embark",
    name: "Cruise Embark",
    park_group: "travel",
    sort_order: 3,
  }),
  p({
    id: "sea",
    name: "Cruise — At Sea",
    park_group: "travel",
    sort_order: 4,
  }),
  p({
    id: "mk",
    name: "Magic Kingdom",
    park_group: "disney",
    sort_order: 10,
  }),
  p({
    id: "exc",
    name: "Shore Excursion",
    park_group: "excursions",
    sort_order: 150,
  }),
];

const hasCruise = false;
const builtFiltered = hasCruise
  ? builtInParks
  : builtInParks.filter((x) => !requiresCruiseSegment(x));

const ids = new Set(builtFiltered.map((x) => x.id));

if (!ids.has("flyout") || !ids.has("flyhome")) {
  console.error("Expected flyout and flyhome for non-cruise land trips");
  process.exit(1);
}

const mustExclude = ["embark", "sea", "exc"] as const;
for (const id of mustExclude) {
  if (ids.has(id)) {
    console.error(
      `Cruise filter failed: ${id} should not be in parksForPrompt when has_cruise=false`,
    );
    process.exit(1);
  }
}

console.log(
  "OK — non-cruise Smart Plan list includes flyout/flyhome and excludes cruise/ship/excursion tiles.",
);
console.log("Built-in ids after filter:", [...ids].sort().join(", "));
