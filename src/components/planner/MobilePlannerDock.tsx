"use client";

import { eachDateKeyInRange } from "@/lib/date-helpers";
import type { SlotType, Trip } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const SLOTS: { key: SlotType; label: string }[] = [
  { key: "am", label: "AM" },
  { key: "pm", label: "PM" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

type Props = {
  trip: Trip | null;
  selectedParkId: string | null;
  onAssign: (dateKey: string, slot: SlotType, parkId: string) => void;
  onNeedParkFirst: () => void;
};

export function MobilePlannerDock({
  trip,
  selectedParkId,
  onAssign,
  onNeedParkFirst,
}: Props) {
  const [dateKey, setDateKey] = useState<string>("");
  const [slot, setSlot] = useState<SlotType>("am");

  const dates = useMemo(() => {
    if (!trip?.start_date || !trip?.end_date) return [];
    return eachDateKeyInRange(trip.start_date, trip.end_date);
  }, [trip?.start_date, trip?.end_date]);

  useEffect(() => {
    if (dates.length && !dateKey) setDateKey(dates[0]);
  }, [dates, dateKey]);

  if (!trip || dates.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-royal/15 bg-cream/98 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:block lg:hidden">
      <p className="mb-2 text-center font-sans text-[0.65rem] font-semibold uppercase tracking-wide text-royal/55">
        Quick place (mobile)
      </p>
      <div className="flex flex-wrap items-end justify-center gap-2">
        <label className="flex min-w-[8rem] flex-col gap-0.5 font-sans text-[0.7rem] text-royal/70">
          Day
          <select
            value={dateKey || dates[0]}
            onChange={(e) => setDateKey(e.target.value)}
            className="rounded-lg border border-royal/25 bg-white px-2 py-1.5 text-sm text-royal"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[5rem] flex-col gap-0.5 font-sans text-[0.7rem] text-royal/70">
          Slot
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value as SlotType)}
            className="rounded-lg border border-royal/25 bg-white px-2 py-1.5 text-sm text-royal"
          >
            {SLOTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            if (!selectedParkId) {
              onNeedParkFirst();
              return;
            }
            const dk = dateKey || dates[0];
            onAssign(dk, slot, selectedParkId);
          }}
          className="rounded-lg bg-gold px-4 py-2 font-sans text-sm font-semibold text-royal"
        >
          Place park
        </button>
      </div>
    </div>
  );
}
