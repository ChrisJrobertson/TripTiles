import type { Trip } from "@/lib/types";

/** String map from `trip.preferences.ai_day_crowd_notes` (date key → text). */
export function plannerAiDayCrowdNotes(trip: Trip): Record<string, string> {
  const raw = trip.preferences?.ai_day_crowd_notes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

/** String map from `trip.preferences.day_notes` (date key → text). */
export function plannerUserDayNotes(trip: Trip): Record<string, string> {
  const raw = trip.preferences?.day_notes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
