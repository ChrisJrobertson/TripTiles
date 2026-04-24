import type { AiDayTimeline, AiDayTimelineBlock } from "@/lib/types";
import type {
  Assignment,
  Assignments,
  SlotAssignmentValue,
  SlotType,
} from "@/lib/types";
import {
  getParkIdFromSlotValue,
  slotValueWithOptionalTime,
  timeToMinutes,
} from "@/lib/assignment-slots";

function hhmm(s: string): string {
  const [a, b] = s.split(":");
  const h = Math.min(23, Math.max(0, parseInt(a ?? "0", 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(b ?? "0", 10) || 0));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const ORDERED_SLOTS: SlotType[] = ["am", "lunch", "pm", "dinner"];

/** Map calendar slot to AI `timeline[].block` keys. */
function aiBlocksForSlot(slot: SlotType): AiDayTimelineBlock[] {
  switch (slot) {
    case "am":
      return ["morning"];
    case "lunch":
      return ["lunch"];
    case "pm":
      return ["afternoon"];
    case "dinner":
      return ["dinner", "evening"];
    default:
      return [];
  }
}

function rowsByBlock(
  rich: AiDayTimeline,
): Map<AiDayTimelineBlock, typeof rich.timeline> {
  const m = new Map<AiDayTimelineBlock, typeof rich.timeline>();
  for (const row of rich.timeline) {
    const list = m.get(row.block) ?? [];
    list.push(row);
    m.set(row.block, list);
  }
  return m;
}

function sortByTime(
  rows: { time: string; title: string; tag?: string }[],
): typeof rows {
  return [...rows].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

function titleLikelyMatchesPark(title: string, parkName: string): boolean {
  const t = title.toLowerCase().trim();
  const name = parkName.toLowerCase().trim();
  if (!name) return false;
  const words = name.split(/\s+/).filter((w) => w.length > 2);
  for (const w of words) {
    if (t.includes(w)) return true;
  }
  const first = name.split(/\s+/)[0] ?? "";
  if (first.length > 1 && t.includes(first)) return true;
  return false;
}

/**
 * Picks a start time (HH:mm) for one calendar slot from AI rows in the
 * corresponding block(s). Prefers a row whose title matches the park name,
 * then first non–break/transport step, else earliest time.
 */
function pickStartTimeForSlot(
  rows: { time: string; title: string; tag?: string }[],
  parkName: string,
): string | null {
  if (rows.length === 0) return null;
  const sorted = sortByTime(rows);
  if (parkName.trim()) {
    const withPark = sorted.find(
      (r) =>
        titleLikelyMatchesPark(r.title, parkName) &&
        r.tag !== "break" &&
        r.tag !== "transport",
    );
    if (withPark) return hhmm(withPark.time);
    const withPark2 = sorted.find((r) =>
      titleLikelyMatchesPark(r.title, parkName),
    );
    if (withPark2) return hhmm(withPark2.time);
  }
  const nonMeta = sorted.find(
    (r) => r.tag !== "break" && r.tag !== "transport",
  );
  if (nonMeta) return hhmm(nonMeta.time);
  return hhmm(sorted[0]!.time);
}

/**
 * Infers { am?, lunch?, pm?, dinner? } as HH:mm from the AI day timeline
 * and the parks already on the day’s assignment.
 */
export function inferSlotStartTimesFromAiDayTimeline(
  rich: AiDayTimeline,
  day: Assignment,
  parkIdToName: Map<string, string>,
): Partial<Record<SlotType, string>> {
  const byBlock = rowsByBlock(rich);
  const out: Partial<Record<SlotType, string>> = {};

  for (const slot of ORDERED_SLOTS) {
    const pid = getParkIdFromSlotValue(day[slot]);
    if (!pid) continue;
    const parkName = parkIdToName.get(pid) ?? "";
    const blocks = aiBlocksForSlot(slot);
    const collected: { time: string; title: string; tag?: string }[] = [];
    for (const b of blocks) {
      const rows = byBlock.get(b);
      if (rows) collected.push(...rows);
    }
    if (collected.length === 0) continue;
    const t = pickStartTimeForSlot(collected, parkName);
    if (t) out[slot] = t;
  }
  return out;
}

/**
 * Merges inferred slot start times from an AI day timeline into `assignments[dateKey]`.
 * Preserves park IDs; only adds/updates optional `time` on slot values.
 * Returns a new `Assignments` object if anything changes; otherwise the original ref.
 */
export function applyAiTimelineToAssignmentSlotTimes(
  assignments: Assignments,
  dateKey: string,
  rich: AiDayTimeline,
  parkIdToName: Map<string, string>,
): Assignments {
  const day = assignments[dateKey];
  if (!day || typeof day !== "object" || Array.isArray(day)) {
    return assignments;
  }

  const inferred = inferSlotStartTimesFromAiDayTimeline(
    rich,
    day,
    parkIdToName,
  );
  const dayNext: Assignment = { ...day };
  let changed = false;

  for (const slot of ORDERED_SLOTS) {
    const t = inferred[slot];
    if (t == null) continue;
    const pid = getParkIdFromSlotValue(dayNext[slot]);
    if (!pid) continue;
    const nextVal = slotValueWithOptionalTime(pid, t, slot);
    const before = dayNext[slot];
    if (JSON.stringify(nextVal) !== JSON.stringify(before)) {
      dayNext[slot] = nextVal;
      changed = true;
    }
  }

  if (!changed) return assignments;
  return { ...assignments, [dateKey]: dayNext };
}

function slotValueHasCustomTime(
  v: SlotAssignmentValue | undefined,
): boolean {
  if (v == null || v === "" || typeof v === "string") return false;
  if (
    typeof v === "object" &&
    v &&
    typeof (v as { time?: string }).time === "string" &&
    (v as { time: string }).time.trim() !== ""
  ) {
    return true;
  }
  return false;
}

/**
 * For the Pro draggable 4-block timeline: show start times that match the AI
 * day plan (`ai_day_timeline`) when the guest has not set a custom time on that
 * slot. Drag/typed times on `Assignment` (object with `time`) are left as-is.
 */
export function displayDayForTimelinePanel(
  day: Assignment,
  rich: AiDayTimeline | undefined,
  parkIdToName: Map<string, string>,
): Assignment {
  if (!rich) return day;
  const inferred = inferSlotStartTimesFromAiDayTimeline(
    rich,
    day,
    parkIdToName,
  );
  if (Object.keys(inferred).length === 0) return day;
  const out: Assignment = { ...day };
  for (const slot of ORDERED_SLOTS) {
    const pid = getParkIdFromSlotValue(out[slot]);
    if (!pid) continue;
    if (slotValueHasCustomTime(out[slot])) continue;
    const t = inferred[slot];
    if (t == null) continue;
    out[slot] = slotValueWithOptionalTime(pid, t, slot);
  }
  return out;
}
