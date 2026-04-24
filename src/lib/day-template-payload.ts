import type { DayTemplatePayload } from "@/types/day-template";

function isSlot(
  v: unknown,
): v is string | { parkId: string; time?: string } {
  if (typeof v === "string") return true;
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.parkId === "string";
}

export function parseDayTemplatePayload(raw: unknown): DayTemplatePayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const assignments = o.assignments;
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments))
    return null;
  const ass = assignments as Record<string, unknown>;
  for (const k of Object.keys(ass)) {
    if (!["am", "pm", "lunch", "dinner"].includes(k)) return null;
    if (!isSlot(ass[k])) return null;
  }
  const rp = o.ridePriorities;
  if (!Array.isArray(rp)) return null;
  for (const row of rp) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const r = row as Record<string, unknown>;
    if (r.attractionId != null && typeof r.attractionId !== "string") return null;
    if (r.priority !== "must_do" && r.priority !== "if_time") return null;
    if (typeof r.sortOrder !== "number" || !Number.isFinite(r.sortOrder)) return null;
    if (
      r.skipLineReturnHhmm != null &&
      typeof r.skipLineReturnHhmm !== "string"
    ) {
      return null;
    }
    if (r.pastedQueueMinutes != null) {
      if (typeof r.pastedQueueMinutes !== "number" || !Number.isFinite(r.pastedQueueMinutes)) {
        return null;
      }
    }
  }
  const dayNote = o.dayNote;
  if (dayNote != null && typeof dayNote !== "string") return null;
  return {
    version: 1,
    assignments: ass as DayTemplatePayload["assignments"],
    ridePriorities: rp as DayTemplatePayload["ridePriorities"],
    dayNote: dayNote == null ? null : dayNote,
  };
}

export const SEED_TEMPLATE_DEFINITIONS: Array<{
  name: string;
  payload: DayTemplatePayload;
}> = [
  {
    name: "Typical MK Day",
    payload: {
      version: 1,
      assignments: {
        am: { parkId: "mk" },
        lunch: { parkId: "mk" },
        pm: { parkId: "mk" },
        dinner: { parkId: "mk" },
      },
      ridePriorities: [
        {
          attractionId: null,
          label: "Opening ride (rope drop)",
          priority: "must_do",
          sortOrder: 0,
        },
        {
          attractionId: null,
          label: "Parade viewing spot",
          priority: "must_do",
          sortOrder: 1,
        },
        {
          attractionId: null,
          label: "Any favourite ride #2",
          priority: "if_time",
          sortOrder: 0,
        },
        {
          attractionId: null,
          label: "Fireworks",
          priority: "must_do",
          sortOrder: 2,
        },
      ],
      dayNote:
        "Early start — leave hotel by 07:30. Pack ponchos.",
    },
  },
  {
    name: "Pool / Rest Day",
    payload: {
      version: 1,
      assignments: {},
      ridePriorities: [],
      dayNote:
        "Rest day — pool, late brunch, short resort walk. No parks.",
    },
  },
  {
    name: "Travel Day",
    payload: {
      version: 1,
      assignments: { dinner: { parkId: "ds" } },
      ridePriorities: [],
      dayNote:
        "Travel day. Confirm Magical Express / car hire. Light dinner only.",
    },
  },
];
