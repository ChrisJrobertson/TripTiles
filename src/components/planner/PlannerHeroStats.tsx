"use client";

import { computeTripStats } from "@/lib/compute-trip-stats";
import { daysUntilTripStart, tripStartValueLabel } from "@/lib/trip-start-label";
import { MetricPill } from "@/components/ui/MetricPill";
import type { Park, Trip } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

type Props = {
  trip: Trip;
  parks: Park[];
};

/**
 * Inline hero stats row (replaces separate “Your trip at a glance” card + countdown pill).
 */
export function PlannerHeroStats({ trip, parks }: Props) {
  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);
  const stats = useMemo(
    () => computeTripStats(trip, parkById),
    [trip, parkById],
  );

  const [startDiff, setStartDiff] = useState(() =>
    trip?.start_date ? daysUntilTripStart(trip.start_date) : 0,
  );

  useEffect(() => {
    if (!trip?.start_date) return;
    setStartDiff(daysUntilTripStart(trip.start_date));
  }, [trip?.start_date]);

  const startsValue = trip?.start_date ? tripStartValueLabel(startDiff) : "—";

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <MetricPill
        label="Starts in"
        value={startsValue}
        icon="⏳"
        variant="magic"
      />
      <MetricPill label="Trip length" value={`${stats.totalDays} days`} icon="🗓️" />
      <MetricPill label="Park days" value={stats.parkDays} icon="🎢" variant="magic" />
      <MetricPill label="Rest days" value={stats.restDays} icon="😴" variant="warm" />
      <MetricPill
        label="Meals"
        value={`${stats.mealSlotsFilled} planned`}
        icon="🍽️"
        variant="warning"
      />
      <MetricPill
        label="Most visited"
        value={
          stats.mostVisitedName
            ? `${stats.mostVisitedName} (${stats.mostVisitedDayCount}d)`
            : "—"
        }
        icon="🏰"
      />
    </div>
  );
}
