import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import type { Assignments, Trip } from "@/lib/types";

const SLOTS = ["am", "pm", "lunch", "dinner"] as const;

export function collectParkIdsFromAssignments(
  assignments: Assignments | undefined | null,
): Set<string> {
  const ids = new Set<string>();
  if (!assignments || typeof assignments !== "object") return ids;
  for (const slots of Object.values(assignments)) {
    if (!slots || typeof slots !== "object") continue;
    for (const slot of SLOTS) {
      const id = getParkIdFromSlotValue(slots[slot]);
      if (id) ids.add(id);
    }
  }
  return ids;
}

export function collectParkIdsFromTrips(trips: Trip[]): Set<string> {
  const ids = new Set<string>();
  for (const t of trips) {
    for (const id of collectParkIdsFromAssignments(t.assignments)) ids.add(id);
  }
  return ids;
}

export type PassportTripDerivedStatus = "upcoming" | "current" | "past";

/** Compare ISO calendar strings YYYY-MM-DD (UTC “today” is typical). */
export function deriveTripStatus(
  todayYMD: string,
  startDate: string,
  endDate: string,
): PassportTripDerivedStatus {
  const s = startDate.trim().slice(0, 10);
  const e = endDate.trim().slice(0, 10);
  const t = todayYMD.trim().slice(0, 10);
  if (!s || !e) return "upcoming";
  if (e < t) return "past";
  if (s > t) return "upcoming";
  return "current";
}

export function utcTodayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

export function passportStatusLabel(
  status: PassportTripDerivedStatus,
): string {
  if (status === "past") return "Past trip";
  if (status === "upcoming") return "Upcoming";
  return "In progress";
}
