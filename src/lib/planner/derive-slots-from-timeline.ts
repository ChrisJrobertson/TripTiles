import { timeToMinutes } from "@/lib/assignment-slots";
import type {
  AiDayTimeline,
  AiDayTimelineBlock,
} from "@/lib/types";

export type TimelineEntry = AiDayTimeline["timeline"][number];

export interface DerivedSlot {
  /** Primary line (e.g. first meaningful stop title). */
  label: string;
  /** e.g. "+2 more" when several distinct titles. */
  sublabel?: string;
  sourceCount: number;
  /** Indices into `AiDayTimeline.timeline` (string for stable React keys). */
  entryIds: string[];
}

export interface DerivedDayPlan {
  am: DerivedSlot | null;
  pm: DerivedSlot | null;
  lunch: DerivedSlot | null;
  dinner: DerivedSlot | null;
}

const EMPTY_PLAN: DerivedDayPlan = {
  am: null,
  pm: null,
  lunch: null,
  dinner: null,
};

function blocksForPlannerSlot(
  slot: keyof DerivedDayPlan,
): AiDayTimelineBlock[] {
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

function isMetaTag(tag: string | undefined): boolean {
  return tag === "break" || tag === "transport";
}

function sortIndicesByTime(
  indices: number[],
  timeline: TimelineEntry[],
): number[] {
  return [...indices].sort(
    (a, b) =>
      timeToMinutes(timeline[a]!.time) - timeToMinutes(timeline[b]!.time),
  );
}

function summarizeSlot(
  indices: number[],
  timeline: TimelineEntry[],
): DerivedSlot | null {
  if (indices.length === 0) return null;
  const sortedIdx = sortIndicesByTime(indices, timeline);
  const rows = sortedIdx.map((i) => timeline[i]!);
  const contentIdx = sortedIdx.filter((i) => !isMetaTag(timeline[i]!.tag));
  const useIdx = contentIdx.length ? contentIdx : sortedIdx;
  const useRows = useIdx.map((i) => timeline[i]!);
  const titles = [
    ...new Set(useRows.map((r) => r.title.trim()).filter(Boolean)),
  ];
  const label = (useRows[0]?.title ?? rows[0]!.title).trim() || "Planned";
  let sublabel: string | undefined;
  if (titles.length > 1) {
    sublabel = `+${titles.length - 1} more`;
  } else if (indices.length > 1) {
    sublabel = `+${indices.length - 1} stops`;
  }
  return {
    label,
    sublabel,
    sourceCount: indices.length,
    entryIds: sortedIdx.map(String),
  };
}

/**
 * Derives AM/PM/Lunch/Dinner calendar summaries from Plan-this-day rows.
 * `block` is the primary bucket; entries are not persisted — render-only.
 */
export function deriveDayPlanFromTimeline(
  rich: AiDayTimeline | null | undefined,
): DerivedDayPlan {
  if (!rich?.timeline?.length) return { ...EMPTY_PLAN };

  const timeline = rich.timeline;
  const buckets: Record<keyof DerivedDayPlan, number[]> = {
    am: [],
    pm: [],
    lunch: [],
    dinner: [],
  };

  for (let i = 0; i < timeline.length; i++) {
    const row = timeline[i]!;
    for (const slot of Object.keys(buckets) as (keyof DerivedDayPlan)[]) {
      if (blocksForPlannerSlot(slot).includes(row.block)) {
        buckets[slot].push(i);
        break;
      }
    }
  }

  return {
    am: summarizeSlot(buckets.am, timeline),
    pm: summarizeSlot(buckets.pm, timeline),
    lunch: summarizeSlot(buckets.lunch, timeline),
    dinner: summarizeSlot(buckets.dinner, timeline),
  };
}

/** Tooltip / accessible description for a derived slot. */
export function describeDerivedSlotTooltip(
  rich: AiDayTimeline,
  slot: DerivedSlot,
): string {
  const lines: string[] = [];
  for (const id of slot.entryIds) {
    const i = Number.parseInt(id, 10);
    const row = rich.timeline[i];
    if (!row) continue;
    const sub = row.subtitle?.trim();
    lines.push(
      sub
        ? `${row.time} — ${row.title} (${sub})`
        : `${row.time} — ${row.title}`,
    );
  }
  return lines.join("\n");
}
