"use client";

import type { Assignment, Park } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import {
  aiTimelineClashItemsFromPreferences,
  detectSkipLineClashes,
  selectPreferredClashMessage,
  userSlotTimesFromAssignment,
} from "@/lib/skip-line-clashes";

export type BookingAnchorDayClashBannerProps = {
  plannerPreferences: Record<string, unknown> | null | undefined;
  dateKey: string;
  dayAssignment: Partial<Assignment> | undefined;
  parkById: ReadonlyMap<string, Park>;
  ridePriorities: TripRidePriority[];
  className?: string;
};

/**
 * Day-level amber summary when a booked skip-the-line return overlaps the AI
 * day timeline or custom slot times. Per-row hints still live on return fields.
 */
export function BookingAnchorDayClashBanner({
  plannerPreferences,
  dateKey,
  dayAssignment,
  parkById,
  ridePriorities,
  className,
}: BookingAnchorDayClashBannerProps) {
  const ridesForClash = ridePriorities
    .filter((r) => r.skip_line_return_hhmm?.trim())
    .map((r) => ({
      id: r.id,
      attractionName: r.attraction?.name ?? "Ride",
      skipLineReturnHhmm: r.skip_line_return_hhmm?.trim() ?? null,
    }));

  if (ridesForClash.length === 0) return null;

  const aiTimelineItems = aiTimelineClashItemsFromPreferences(
    plannerPreferences,
    dateKey,
  );
  const userSlotTimes = userSlotTimesFromAssignment(dayAssignment, parkById);
  const clashMap = detectSkipLineClashes({
    rides: ridesForClash,
    aiTimelineItems,
    userSlotTimes,
  });

  const lines: { name: string; time: string; detail: string }[] = [];
  for (const r of ridePriorities) {
    const t = r.skip_line_return_hhmm?.trim();
    if (!t) continue;
    const clashes = clashMap.get(r.id);
    if (!clashes?.length) continue;
    const msg = selectPreferredClashMessage(clashes);
    if (!msg) continue;
    lines.push({
      name: r.attraction?.name ?? "Booked skip-the-line return",
      time: t,
      detail: msg,
    });
  }

  if (lines.length === 0) return null;

  return (
    <div
      className={`rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 dark:border-amber-700/50 dark:bg-amber-950/40 ${className ?? ""}`}
      role="status"
    >
      <p className="font-sans text-xs font-semibold text-amber-900 dark:text-amber-100">
        Booked return time conflicts
      </p>
      <ul className="mt-2 list-none space-y-2 font-sans text-xs leading-relaxed text-amber-900/90 dark:text-amber-50/95">
        {lines.map((line, i) => (
          <li key={`${line.name}-${line.time}-${i}`}>
            <span aria-hidden>⚠️ </span>
            Your booked Lightning Lane for <strong>{line.name}</strong> at{" "}
            <strong>{line.time}</strong> — {line.detail}. Review this day&apos;s
            plan.
          </li>
        ))}
      </ul>
    </div>
  );
}
