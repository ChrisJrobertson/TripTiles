import { getParkIdFromSlotValue, getSlotTimeFromValue } from "@/lib/assignment-slots";
import type { Assignment, Park, SlotType } from "@/lib/types";

export type SkipLineClash = {
  kind:
    | "return_overlap"
    | "dining_overlap"
    | "show_overlap"
    | "slot_time_overlap";
  withLabel: string;
  message: string;
};

const RETURN_OVERLAP_MIN = 60;
const ADR_PROXIMITY_MIN = 45;
const SHOW_PROXIMITY_MIN = 30;
const USER_SLOT_PROXIMITY_MIN = 45;

const CLASH_KIND_PRIORITY: Record<SkipLineClash["kind"], number> = {
  return_overlap: 0,
  show_overlap: 1,
  dining_overlap: 2,
  slot_time_overlap: 3,
};

const SLOT_UK: Record<SlotType, string> = {
  am: "AM",
  pm: "PM",
  lunch: "Lunch",
  dinner: "Dinner",
};

function parseHhmmToMin(hhmm: string): number {
  const t = hhmm.trim();
  const [h, m] = t.split(":").map((x) => parseInt(x, 10) || 0);
  return Math.min(23 * 60 + 59, Math.max(0, h * 60 + m));
}

function normaliseHhmm(h: string): string {
  return h.trim().match(/^(\d{1,2}:\d{2})/)?.[1] ?? h.trim();
}

/**
 * ADR and show entries from `trips.preferences.ai_day_timeline[date]`, without
 * requiring the full `getAiDayTimelineForDate` strict validation.
 */
export function aiTimelineClashItemsFromPreferences(
  preferences: Record<string, unknown> | null | undefined,
  dateKey: string,
): { tag: "adr" | "show"; time: string; title: string }[] {
  if (!preferences || typeof preferences !== "object") return [];
  const raw = preferences.ai_day_timeline;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const day = (raw as Record<string, unknown>)[dateKey];
  if (!day || typeof day !== "object" || day === null) return [];
  const timeline = (day as { timeline?: unknown }).timeline;
  if (!Array.isArray(timeline)) return [];
  const out: { tag: "adr" | "show"; time: string; title: string }[] = [];
  for (const row of timeline) {
    if (!row || typeof row !== "object" || row === null) continue;
    const o = row as { tag?: string; time?: string; title?: string };
    if (o.tag !== "adr" && o.tag !== "show") continue;
    if (typeof o.time !== "string" || !o.time.trim()) continue;
    if (!/^\d{1,2}:\d{2}/.test(o.time.trim())) continue;
    out.push({
      tag: o.tag,
      time: normaliseHhmm(o.time),
      title: typeof o.title === "string" && o.title.trim() ? o.title.trim() : "Item",
    });
  }
  return out;
}

/**
 * Object-shaped assignment slots (guest set time) with effective HH:mm and label.
 */
export function userSlotTimesFromAssignment(
  day: Partial<Assignment> | undefined,
  parkById: ReadonlyMap<string, Park>,
): { slot: SlotType; time: string; label: string }[] {
  if (!day) return [];
  const out: { slot: SlotType; time: string; label: string }[] = [];
  for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
    const v = day[slot];
    if (v == null || v === "" || typeof v === "string") continue;
    if (typeof v === "object" && v !== null) {
      const pid = getParkIdFromSlotValue(v);
      const pName = pid ? (parkById.get(pid)?.name ?? pid) : "Park";
      const time = getSlotTimeFromValue(slot, v);
      out.push({
        slot,
        time,
        label: `${SLOT_UK[slot]} (${pName})`,
      });
    }
  }
  return out;
}

/**
 * Returns clashes keyed by `rides[].id` (trip_ride_priorities.id).
 * Informational only — does not block saves.
 */
export function detectSkipLineClashes(input: {
  rides: Array<{
    id: string;
    attractionName: string;
    skipLineReturnHhmm: string | null;
  }>;
  aiTimelineItems: Array<{
    tag: "adr" | "show";
    time: string;
    title: string;
  }>;
  userSlotTimes: Array<{
    slot: SlotType;
    time: string;
    label: string;
  }>;
}): Map<string, SkipLineClash[]> {
  const out = new Map<string, SkipLineClash[]>();
  const { rides, aiTimelineItems, userSlotTimes } = input;
  const withTime = rides.filter(
    (r) => r.skipLineReturnHhmm != null && r.skipLineReturnHhmm.trim() !== "",
  );
  if (withTime.length === 0) return out;

  const push = (id: string, c: SkipLineClash) => {
    const prev = out.get(id) ?? [];
    prev.push(c);
    out.set(id, prev);
  };

  for (let i = 0; i < withTime.length; i += 1) {
    for (let j = i + 1; j < withTime.length; j += 1) {
      const a = withTime[i]!;
      const b = withTime[j]!;
      const minA = parseHhmmToMin(a.skipLineReturnHhmm!);
      const minB = parseHhmmToMin(b.skipLineReturnHhmm!);
      const d = Math.abs(minA - minB);
      if (d < RETURN_OVERLAP_MIN) {
        const msgA = `Clashes with ${b.attractionName} at ${b.skipLineReturnHhmm} (return windows are close together).`;
        const msgB = `Clashes with ${a.attractionName} at ${a.skipLineReturnHhmm} (return windows are close together).`;
        push(a.id, {
          kind: "return_overlap",
          withLabel: `${b.attractionName} ${b.skipLineReturnHhmm}`,
          message: msgA,
        });
        push(b.id, {
          kind: "return_overlap",
          withLabel: `${a.attractionName} ${a.skipLineReturnHhmm}`,
          message: msgB,
        });
      }
    }
  }

  for (const r of withTime) {
    const rMin = parseHhmmToMin(r.skipLineReturnHhmm!);
    for (const item of aiTimelineItems) {
      if (item.tag === "adr") {
        const tMin = parseHhmmToMin(item.time);
        if (Math.abs(rMin - tMin) <= ADR_PROXIMITY_MIN) {
          const short = item.title;
          push(r.id, {
            kind: "dining_overlap",
            withLabel: `${short} ${item.time}`,
            message: `Clashes with ${short} at ${item.time}`,
          });
        }
      } else if (item.tag === "show") {
        const tMin = parseHhmmToMin(item.time);
        if (Math.abs(rMin - tMin) <= SHOW_PROXIMITY_MIN) {
          const short = item.title;
          push(r.id, {
            kind: "show_overlap",
            withLabel: `${short} ${item.time}`,
            message: `Clashes with ${short} at ${item.time}`,
          });
        }
      }
    }
  }

  for (const r of withTime) {
    const rMin = parseHhmmToMin(r.skipLineReturnHhmm!);
    for (const u of userSlotTimes) {
      const tMin = parseHhmmToMin(u.time);
      if (Math.abs(rMin - tMin) <= USER_SLOT_PROXIMITY_MIN) {
        push(r.id, {
          kind: "slot_time_overlap",
          withLabel: `${u.label} ${u.time}`,
          message: `Clashes with ${u.label} at ${u.time}`,
        });
      }
    }
  }

  return out;
}

/**
 * Picks a single message: return_vs_return first, then show, dining, then slot.
 */
export function selectPreferredClashMessage(
  clashes: SkipLineClash[] | undefined,
): string | null {
  if (!clashes || clashes.length === 0) return null;
  const sorted = [...clashes].sort(
    (a, b) => CLASH_KIND_PRIORITY[a.kind] - CLASH_KIND_PRIORITY[b.kind],
  );
  return sorted[0]!.message;
}

/** @deprecated use selectPreferredClashMessage */
export function firstClashMessage(
  clashes: SkipLineClash[] | undefined,
): string | null {
  return selectPreferredClashMessage(clashes);
}
