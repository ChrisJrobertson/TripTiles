import { parseDate } from "@/lib/date-helpers";
import type { Trip } from "@/lib/types";

export function isDateKeyInTripRange(
  trip: Pick<Trip, "start_date" | "end_date">,
  dateKey: string,
): boolean {
  const d = parseDate(`${dateKey}T12:00:00`).getTime();
  const s = parseDate(`${trip.start_date}T12:00:00`).getTime();
  const e = parseDate(`${trip.end_date}T12:00:00`).getTime();
  return d >= s && d <= e;
}
