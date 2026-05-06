import { parseDate } from "@/lib/date-helpers";

/** Calendar-day difference from local today to trip start (matches TripTimeline). */
export function daysUntilTripStart(iso: string): number {
  const t = parseDate(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = t.getTime() - start.getTime();
  return Math.ceil(diff / 86400000);
}

/** Short value for hero “starts in” MetricPill (no sparkles / shouty copy). */
export function tripStartValueLabel(diffDays: number): string {
  if (diffDays < 0) return "Now or past";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `${diffDays} days`;
}
