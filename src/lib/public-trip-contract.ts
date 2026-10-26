import { normalizeAdventureTitleColor, ADVENTURE_TITLE_COLOR_KEY } from "@/lib/adventure-title-color";
import { sanitizeAiPlannerDisplayText } from "@/lib/ai-sanitize-notes";
import { normaliseThemeKey } from "@/lib/themes";
import type { Assignment, Assignments, Destination, Trip } from "@/lib/types";

/**
 * Columns a public plan is allowed to read. Private notes, party details,
 * budgets, ownership, and snapshots are intentionally absent.
 * `preferences` is still a JSON blob in the database; `toPublicTrip` keeps
 * only the keys the public page is allowed to show.
 */
export const PUBLIC_TRIP_COLUMNS = [
  "id",
  "adventure_name",
  "destination",
  "region_id",
  "start_date",
  "end_date",
  "has_cruise",
  "cruise_embark",
  "cruise_disembark",
  "assignments",
  "preferences",
  "colour_theme",
  "is_public",
  "public_slug",
  "clone_count",
  "view_count",
  "gallery_owner_label",
  "created_at",
  "updated_at",
  "last_opened_at",
].join(",");

const DESTINATIONS = new Set<Destination>([
  "orlando",
  "paris",
  "tokyo",
  "cali",
  "cruise",
  "custom",
]);

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLOTS = ["am", "lunch", "pm", "dinner"] as const;

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
}

function dateOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 10);
  return DATE_KEY.test(trimmed) ? trimmed : null;
}

function publicAssignments(raw: unknown): Assignments {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Assignments = {};
  for (const [day, slots] of Object.entries(raw as Record<string, unknown>)) {
    if (!DATE_KEY.test(day) || !slots || typeof slots !== "object" || Array.isArray(slots)) {
      continue;
    }
    const next: Assignment = {};
    for (const slot of SLOTS) {
      const value = (slots as Record<string, unknown>)[slot];
      if (typeof value === "string") {
        const parkId = clip(value, 80);
        if (parkId) next[slot] = parkId;
        continue;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const parkId = clip((value as { parkId?: unknown }).parkId, 80);
      if (!parkId) continue;
      const time = (value as { time?: unknown }).time;
      next[slot] =
        typeof time === "string" && TIME_KEY.test(time)
          ? { parkId, time }
          : parkId;
    }
    if (Object.keys(next).length > 0) out[day] = next;
  }
  return out;
}

function publicPreferences(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  const view = source.public_view;
  if (view && typeof view === "object" && !Array.isArray(view)) {
    const record = view as Record<string, unknown>;
    const publicView: Record<string, string> = {};
    const family = clip(record.family_label, 80);
    const title = clip(record.adventure_title, 120);
    if (family) publicView.family_label = family;
    if (title) publicView.adventure_title = title;
    if (Object.keys(publicView).length > 0) out.public_view = publicView;
  }

  const summary = clip(source.ai_crowd_summary, 2000);
  if (summary) out.ai_crowd_summary = sanitizeAiPlannerDisplayText(summary);

  const dayNotes = source.ai_day_crowd_notes;
  if (dayNotes && typeof dayNotes === "object" && !Array.isArray(dayNotes)) {
    const notes: Record<string, string> = {};
    for (const [day, text] of Object.entries(dayNotes as Record<string, unknown>)) {
      if (!DATE_KEY.test(day)) continue;
      const clean = clip(text, 2000);
      if (clean) notes[day] = sanitizeAiPlannerDisplayText(clean);
    }
    if (Object.keys(notes).length > 0) out.ai_day_crowd_notes = notes;
  }

  const titleColor = normalizeAdventureTitleColor(source[ADVENTURE_TITLE_COLOR_KEY]);
  if (titleColor) out[ADVENTURE_TITLE_COLOR_KEY] = titleColor;

  return out;
}

function stamp(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value;
  return new Date(0).toISOString();
}

/** Allowlisted public trip. Sensitive fields are cleared even if the row contains them. */
export function toPublicTrip(row: Record<string, unknown>): Trip {
  const destination = DESTINATIONS.has(row.destination as Destination)
    ? (row.destination as Destination)
    : "custom";
  const region =
    typeof row.region_id === "string" && /^[a-z0-9-]{1,64}$/i.test(row.region_id)
      ? row.region_id
      : null;
  const gallery = clip(row.gallery_owner_label, 80);

  return {
    id: clip(row.id, 36),
    owner_id: "",
    agency_id: null,
    family_name: "",
    adventure_name: clip(row.adventure_name, 120) || "Trip plan",
    destination,
    region_id: region,
    start_date: dateOrNull(row.start_date) ?? "",
    end_date: dateOrNull(row.end_date) ?? "",
    has_cruise: row.has_cruise === true,
    cruise_embark: dateOrNull(row.cruise_embark),
    cruise_disembark: dateOrNull(row.cruise_disembark),
    adults: 0,
    children: 0,
    child_ages: [],
    assignments: publicAssignments(row.assignments),
    preferences: publicPreferences(row.preferences),
    notes: null,
    budget_target: null,
    budget_currency: "GBP",
    is_public: row.is_public === true,
    public_slug: clip(row.public_slug, 80) || null,
    clone_count: Number.isFinite(Number(row.clone_count)) ? Number(row.clone_count) : 0,
    view_count: Number.isFinite(Number(row.view_count)) ? Number(row.view_count) : 0,
    last_opened_at: stamp(row.last_opened_at),
    created_at: stamp(row.created_at),
    updated_at: stamp(row.updated_at),
    previous_assignments_snapshot: null,
    previous_preferences_snapshot: null,
    previous_assignments_snapshot_at: null,
    day_snapshots: [],
    planning_preferences: null,
    planning_preferences_issue: null,
    colour_theme: normaliseThemeKey(
      typeof row.colour_theme === "string" ? row.colour_theme : undefined,
    ),
    email_reminders: false,
    gallery_owner_label: gallery || null,
    is_archived: false,
    archived_reason: null,
  };
}
