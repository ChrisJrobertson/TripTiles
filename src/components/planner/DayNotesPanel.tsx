"use client";

import { updateTripPreferencesPatchAction } from "@/actions/trips";
import { eachDateKeyInRange } from "@/lib/date-helpers";
import type { Trip } from "@/lib/types";
import { useMemo } from "react";

type Props = {
  trip: Trip | null;
  tripId: string;
};

export function DayNotesPanel({ trip, tripId }: Props) {
  const keys = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return [];
    return eachDateKeyInRange(trip.start_date, trip.end_date);
  }, [trip?.start_date, trip?.end_date]);

  if (!trip || keys.length === 0) return null;

  const tripSafe = trip;

  async function saveKey(dateKey: string, value: string) {
    const t = tripSafe;
    const raw = t.preferences?.day_notes;
    const base =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? { ...(raw as Record<string, string>) }
        : {};
    const next = { ...base, [dateKey]: value };
    await updateTripPreferencesPatchAction({
      tripId,
      patch: { day_notes: next },
    });
  }

  return (
    <details
      open
      className="rounded-xl border border-royal/10 bg-white/90 px-3 py-2 font-sans text-sm text-royal shadow-sm"
    >
      <summary className="cursor-pointer font-sans text-xs font-semibold text-royal/75">
        Day notes — closures, hours
      </summary>
      <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
        {keys.map((k) => {
          const raw = tripSafe.preferences?.day_notes;
          const cur =
            raw && typeof raw === "object" && !Array.isArray(raw)
              ? String((raw as Record<string, unknown>)[k] ?? "")
              : "";
          return (
            <label key={k} className="block">
              <span className="text-xs text-royal/55">{k}</span>
              <input
                type="text"
                defaultValue={cur}
                key={`${tripSafe.id}-${k}-${tripSafe.updated_at}`}
                onBlur={(e) => void saveKey(k, e.target.value)}
                placeholder="Optional reminder for this day"
                className="mt-0.5 w-full rounded border border-royal/20 px-2 py-1 text-xs text-royal"
              />
            </label>
          );
        })}
      </div>
    </details>
  );
}
