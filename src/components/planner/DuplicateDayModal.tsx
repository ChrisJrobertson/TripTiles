"use client";

import {
  eachDateKeyInRange,
  formatDateISO,
  parseDate,
} from "@/lib/date-helpers";
import type { Tier } from "@/lib/tier";
import type { Trip } from "@/lib/types";
import { useCallback, useMemo, useState } from "react";

const WEEK: { dow: number; label: string }[] = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
  { dow: 0, label: "Sun" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  tripId: string;
  sourceDate: string;
  productTier: Tier;
  onLockedPaidTemplates: () => void;
  onSuccess: () => void;
};

export function DuplicateDayModal({
  open,
  onClose,
  trip,
  tripId,
  sourceDate,
  productTier,
  onLockedPaidTemplates,
  onSuccess,
}: Props) {
  const [tab, setTab] = useState<"specific" | "recurring">("specific");
  const [merge, setMerge] = useState<"append" | "replace">("append");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [weekdays, setWeekdays] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const rangeKeys = useMemo(
    () => eachDateKeyInRange(trip.start_date, trip.end_date),
    [trip.start_date, trip.end_date],
  );

  const selectableDates = useMemo(
    () => rangeKeys.filter((k) => k !== sourceDate),
    [rangeKeys, sourceDate],
  );

  const recurringPreview = useMemo(() => {
    if (weekdays.size === 0) return [];
    return rangeKeys.filter((k) => {
      if (k === sourceDate) return false;
      const dow = parseDate(`${k}T12:00:00`).getDay();
      return weekdays.has(dow);
    });
  }, [rangeKeys, sourceDate, weekdays]);

  const targets = useMemo(
    () => (tab === "specific" ? [...picked] : recurringPreview),
    [tab, picked, recurringPreview],
  );

  const toggleDate = (k: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const toggleWeekday = (dow: number) => {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(dow)) next.delete(dow);
      else next.add(dow);
      return next;
    });
  };

  const submit = useCallback(async () => {
    if (tab === "recurring" && productTier === "free") {
      onLockedPaidTemplates();
      return;
    }
    if (targets.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/trip/${tripId}/day/${encodeURIComponent(sourceDate)}/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targets,
            merge,
            source: tab === "recurring" ? "recurring-weekday" : "specific",
          }),
        },
      );
      if (res.status === 403) {
        onLockedPaidTemplates();
        return;
      }
      if (!res.ok) throw new Error();
      onSuccess();
      onClose();
    } finally {
      setBusy(false);
    }
  }, [
    tab,
    productTier,
    targets,
    merge,
    tripId,
    sourceDate,
    onLockedPaidTemplates,
    onSuccess,
    onClose,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-royal/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dup-day-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-lg flex-col rounded-t-2xl border border-royal/15 bg-cream shadow-2xl sm:rounded-2xl">
        <div className="shrink-0 border-b border-royal/10 p-4">
          <h2
            id="dup-day-title"
            className="font-serif text-lg font-semibold text-royal"
          >
            Duplicate day
          </h2>
          <div className="mt-3 flex gap-1 rounded-lg border border-royal/15 p-0.5 font-sans text-xs font-semibold">
            <button
              type="button"
              className={`min-h-11 flex-1 rounded-md ${
                tab === "specific" ? "bg-royal text-cream" : "text-royal"
              }`}
              onClick={() => setTab("specific")}
            >
              Specific dates
            </button>
            <button
              type="button"
              className={`relative min-h-11 flex-1 rounded-md ${
                tab === "recurring" ? "bg-royal text-cream" : "text-royal"
              }`}
              onClick={() => {
                if (productTier === "free") {
                  onLockedPaidTemplates();
                  return;
                }
                setTab("recurring");
              }}
            >
              <span className="inline-flex items-center gap-1">
                Recurring weekday
                {productTier === "free" ? (
                  <span aria-hidden title="Pro or Family feature">
                    🔒
                  </span>
                ) : null}
              </span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === "specific" ? (
            <>
              <p className="font-sans text-xs text-royal/70">
                Choose dates inside your trip (excluding this day).
              </p>
              <p className="mt-2 font-sans text-sm font-semibold text-royal">
                Copy to {picked.size} day{picked.size === 1 ? "" : "s"}
              </p>
              <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-lg border border-royal/10 bg-white/80 p-2">
                {selectableDates.map((k) => (
                  <label
                    key={k}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 font-sans text-sm text-royal hover:bg-cream"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(k)}
                      onChange={() => toggleDate(k)}
                      className="h-4 w-4"
                    />
                    {formatDateISO(parseDate(k))}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="font-sans text-xs text-royal/70">
                Pick weekdays — we only include dates inside your trip range.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEK.map(({ dow, label }) => (
                  <button
                    key={dow}
                    type="button"
                    className={`min-h-11 min-w-[2.75rem] rounded-lg border px-2 font-sans text-xs font-semibold ${
                      weekdays.has(dow)
                        ? "border-royal bg-royal text-cream"
                        : "border-royal/20 bg-white text-royal"
                    }`}
                    onClick={() => toggleWeekday(dow)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-3 font-sans text-xs font-semibold text-royal">
                Preview ({recurringPreview.length})
              </p>
              <ul className="mt-1 max-h-36 overflow-y-auto font-mono text-xs text-royal/80">
                {recurringPreview.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-4 flex rounded-lg border border-royal/15 p-0.5 font-sans text-xs font-semibold">
            <button
              type="button"
              className={`min-h-11 flex-1 rounded-md ${
                merge === "append" ? "bg-royal text-cream" : "text-royal"
              }`}
              onClick={() => setMerge("append")}
            >
              Append
            </button>
            <button
              type="button"
              className={`min-h-11 flex-1 rounded-md ${
                merge === "replace" ? "bg-royal text-cream" : "text-royal"
              }`}
              onClick={() => setMerge("replace")}
            >
              Replace
            </button>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap gap-2 border-t border-royal/10 p-4">
          <button
            type="button"
            className="min-h-11 flex-1 rounded-lg bg-royal px-4 font-sans text-sm font-semibold text-cream disabled:opacity-50"
            disabled={busy || targets.length === 0}
            onClick={() => void submit()}
          >
            Duplicate →
          </button>
          <button
            type="button"
            className="min-h-11 flex-1 rounded-lg border border-royal/20 bg-white px-4 font-sans text-sm font-medium text-royal"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
