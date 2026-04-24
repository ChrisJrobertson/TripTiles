import { getParkIdFromSlotValue, getSlotTimeFromValue } from "@/lib/assignment-slots";
import { sortPrioritiesForDay } from "@/lib/ride-plan-display";
import type { Assignment, SlotType } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";

function parseHhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10) || 0);
  return Math.min(23 * 60 + 59, Math.max(0, h * 60 + m));
}

function subMin(hhmm: string, delta: number): string {
  const t = ((parseHhmmToMin(hhmm) - delta) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * v1: align with DayTimeline display defaults (custom slot `time` still wins).
 */
function displaySlotTime(
  slot: SlotType,
  ass: Assignment,
  parkOpen: string,
): string {
  const v = ass[slot];
  if (v && typeof v === "object" && typeof v.time === "string" && v.time.trim()) {
    return getSlotTimeFromValue(slot, v);
  }
  if (slot === "am") return parkOpen;
  if (slot === "lunch") return "12:30";
  if (slot === "pm") return "14:00";
  if (slot === "dinner") return "18:30";
  return getSlotTimeFromValue(slot, v);
}

const MEAL_PROX_M = 40;

function mealProximityWarn(
  returnMin: number,
  label: string,
  mealMin: number,
): string | null {
  const d = Math.abs(returnMin - mealMin);
  if (d <= MEAL_PROX_M) {
    return `This return is within ~${d} min of your ${label} block (~${formatMinHhmm(mealMin)} on the day timeline) — allow time to move or eat.`;
  }
  return null;
}

function formatMinHhmm(total: number): string {
  const t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export type SkipLineDayTimelineRow = {
  time: string;
  title: string;
  subtitle?: string;
  /** Amber styling in DayTimeline */
  warn?: boolean;
};

/**
 * Build rows for the day timeline: guest LL/Express return times plus optional
 * clash hints vs meal / rope-drop pacing.
 */
export function buildSkipLineDayTimelineRows(
  ass: Assignment,
  rideRows: TripRidePriority[],
  parkOpen: string,
): SkipLineDayTimelineRow[] {
  const sorted = sortPrioritiesForDay(rideRows).filter(
    (r) => r.attraction && r.skip_line_return_hhmm?.trim(),
  );
  if (sorted.length === 0) return [];

  const amId = getParkIdFromSlotValue(ass.am);
  const amTime = amId ? displaySlotTime("am", ass, parkOpen) : parkOpen;
  const ropeTime = amId ? subMin(amTime, 30) : null;
  const lunchT = getParkIdFromSlotValue(ass.lunch)
    ? displaySlotTime("lunch", ass, parkOpen)
    : null;
  const dinnerT = getParkIdFromSlotValue(ass.dinner)
    ? displaySlotTime("dinner", ass, parkOpen)
    : null;

  const out: SkipLineDayTimelineRow[] = [];

  for (const r of sorted) {
    const t = r.skip_line_return_hhmm!.trim();
    const name = r.attraction!.name;
    const returnMin = parseHhmmToMin(t);
    const parts: string[] = [];
    let warn = false;

    if (ropeTime) {
      const ropeM = parseHhmmToMin(ropeTime);
      if (returnMin < ropeM + 90) {
        parts.push("Very close to rope-drop — confirm this is a return, not a booking deadline.");
        warn = true;
      }
    }
    if (lunchT) {
      const w = mealProximityWarn(
        returnMin,
        "lunch",
        parseHhmmToMin(lunchT),
      );
      if (w) {
        parts.push(w);
        warn = true;
      }
    }
    if (dinnerT) {
      const w = mealProximityWarn(
        returnMin,
        "dinner",
        parseHhmmToMin(dinnerT),
      );
      if (w) {
        parts.push(w);
        warn = true;
      }
    }

    const sub = [parts.join(" "), r.notes?.trim() ? `Note: ${r.notes.trim()}` : null]
      .filter(Boolean)
      .join(" ");

    out.push({
      time: t,
      title: `⚡ Return — ${name}`,
      subtitle: sub || undefined,
      warn: warn || undefined,
    });
  }

  return out.sort((a, b) => parseHhmmToMin(a.time) - parseHhmmToMin(b.time));
}
