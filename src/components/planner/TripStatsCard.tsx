"use client";

import {
  buildTripStatsShareText,
  computeTripStats,
  type TripStatsSummary,
} from "@/lib/compute-trip-stats";
import type { Park, Trip } from "@/lib/types";
import { useMemo, useState } from "react";

type Props = {
  trip: Trip;
  parks: Park[];
  destinationLabel: string;
  onToast: (msg: string) => void;
};

export function TripStatsCard({
  trip,
  parks,
  destinationLabel,
  onToast,
}: Props) {
  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);
  const stats: TripStatsSummary = useMemo(
    () => computeTripStats(trip, parkById),
    [trip, parkById],
  );
  const [open, setOpen] = useState(true);

  async function copyShare() {
    const text = buildTripStatsShareText(stats, destinationLabel);
    try {
      await navigator.clipboard.writeText(text);
      onToast("Stats copied — share it with your group!");
    } catch {
      onToast("Couldn’t copy — try again.");
    }
  }

  return (
    <section className="mb-5 rounded-2xl border border-royal/12 bg-cream p-4 shadow-sm">
      <button
        type="button"
        className="flex w-full min-h-[44px] items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <h3 className="font-serif text-lg font-semibold text-royal">
          📊 Your trip at a glance
        </h3>
        <span className="text-royal/50">{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <>
          <p className="mt-2 font-sans text-sm leading-relaxed text-royal/80">
            <span className="whitespace-nowrap">🗓️ {stats.totalDays} days</span>
            {" · "}
            <span className="whitespace-nowrap">🎢 {stats.parkDays} park days</span>
            {" · "}
            <span className="whitespace-nowrap">😴 {stats.restDays} rest days</span>
            {" · "}
            <span className="whitespace-nowrap">
              🍽️ {stats.mealSlotsFilled} meals planned
            </span>
          </p>
          {stats.mostVisitedName ? (
            <p className="mt-2 font-sans text-sm text-royal">
              🏰 Most visited:{" "}
              <span className="font-semibold">
                {stats.mostVisitedName} ({stats.mostVisitedDayCount}{" "}
                {stats.mostVisitedDayCount === 1 ? "day" : "days"})
              </span>
            </p>
          ) : null}
          <p className="mt-1 font-sans text-sm text-royal">
            👟 Est. walking: ~{stats.estimatedMiles} miles (
            {Math.round(stats.estimatedMiles * 1.60934)} km)
          </p>
          <p className="mt-1 font-sans text-sm text-royal">
            📋 Plan completeness: {stats.completenessPct}%
          </p>
          {stats.namedRestaurantCount > 0 ? (
            <p className="mt-1 font-sans text-xs text-royal/65">
              {stats.namedRestaurantCount} named restaurant
              {stats.namedRestaurantCount === 1 ? "" : "s"} on the plan
            </p>
          ) : null}
          <button
            type="button"
            className="mt-4 min-h-[44px] w-full rounded-lg border border-royal/25 bg-white px-4 font-sans text-sm font-semibold text-royal transition hover:bg-cream"
            onClick={() => void copyShare()}
          >
            Share my stats
          </button>
        </>
      ) : null}
    </section>
  );
}
