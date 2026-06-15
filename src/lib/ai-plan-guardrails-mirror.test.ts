import { applyFullSingleParkDayMirroring } from "@/lib/ai-plan-guardrails";
import type { Assignments, Park } from "@/lib/types";

function mkPark(id: string, group: string): Park {
  return {
    id,
    name: id,
    icon: null,
    bg_colour: "#000",
    fg_colour: "#fff",
    park_group: group,
    destinations: [],
    region_ids: [],
    is_custom: false,
    sort_order: 0,
  };
}

const parksById = new Map<string, Park>([
  ["mk", mkPark("Magic Kingdom", "disney")],
  ["ep", mkPark("EPCOT", "disney")],
  ["rest", mkPark("Rest / Pool", "activities")],
]);

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const amOnly: Assignments = {
  "2026-07-09": { am: "mk" },
};
const mirrored = applyFullSingleParkDayMirroring(amOnly, parksById);
assert(mirrored["2026-07-09"]?.pm === "mk", "am-only mk should mirror to pm");

const hop: Assignments = {
  "2026-07-10": { am: "mk", pm: "ep" },
};
const hopOut = applyFullSingleParkDayMirroring(hop, parksById);
assert(hopOut["2026-07-10"]?.am === "mk", "hop day am unchanged");
assert(hopOut["2026-07-10"]?.pm === "ep", "hop day pm unchanged");

const pmOnly: Assignments = {
  "2026-07-11": { pm: "ep" },
};
const pmMirrored = applyFullSingleParkDayMirroring(pmOnly, parksById);
assert(pmMirrored["2026-07-11"]?.am === "ep", "pm-only ep should mirror to am");

const restDay: Assignments = {
  "2026-07-12": { am: "rest" },
};
const restOut = applyFullSingleParkDayMirroring(restDay, parksById);
assert(restOut["2026-07-12"]?.pm === undefined, "rest tile should not mirror");

console.log("ai-plan-guardrails-mirror tests: OK");
