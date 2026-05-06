"use client";

import { updateRidePriorityMeta } from "@/actions/ride-priorities";
import { BookingConflictModal } from "@/components/planner/BookingConflictModal";
import {
  anchorsOnTargetDay,
  type BookingAnchor,
} from "@/lib/booking-anchor-risk";
import {
  eachDateKeyInRange,
  formatDateISO,
  parseDate,
} from "@/lib/date-helpers";
import type { Tier } from "@/lib/tier";
import type { Park, Trip } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  ridePrioritiesByDay: Record<string, TripRidePriority[]>;
  parks: Park[];
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
  ridePrioritiesByDay,
  parks,
}: Props) {
  const [tab, setTab] = useState<"specific" | "recurring">("specific");
  const [merge, setMerge] = useState<"append" | "replace">("append");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [weekdays, setWeekdays] = useState<Set<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [replaceDayAnchors, setReplaceDayAnchors] = useState<{
    targets: string[];
    anchors: BookingAnchor[];
  } | null>(null);

  const parkById = useMemo(
    () => new Map(parks.map((p) => [p.id, p] as const)),
    [parks],
  );

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

  const runDuplicateRequest = useCallback(
    async (targetList: string[], mergeMode: "append" | "replace") => {
      setBusy(true);
      try {
        const res = await fetch(
          `/api/trip/${tripId}/day/${encodeURIComponent(sourceDate)}/duplicate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targets: targetList,
              merge: mergeMode,
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
    },
    [tab, tripId, sourceDate, onLockedPaidTemplates, onSuccess, onClose],
  );

  const submit = useCallback(async () => {
    if (tab === "recurring" && productTier === "free") {
      onLockedPaidTemplates();
      return;
    }
    if (targets.length === 0) return;
    if (merge === "replace") {
      const allAnchors = targets.flatMap((d) =>
        anchorsOnTargetDay(ridePrioritiesByDay[d] ?? [], parkById),
      );
      if (allAnchors.length > 0) {
        setReplaceDayAnchors({ targets: [...targets], anchors: allAnchors });
        return;
      }
    }
    await runDuplicateRequest(targets, merge);
  }, [
    tab,
    productTier,
    targets,
    merge,
    ridePrioritiesByDay,
    parkById,
    onLockedPaidTemplates,
    runDuplicateRequest,
  ]);

  useEffect(() => {
    if (!open) setReplaceDayAnchors(null);
  }, [open]);

  if (!open) return null;

  return (
    <>
    <ModalShell
      zClassName="z-[120]"
      bottomSheetOnMobile
      overlayClassName="bg-tt-royal/50 backdrop-blur-[1px]"
      maxWidthClass="max-w-lg"
      panelClassName="flex max-h-[min(90vh,40rem)] flex-col overflow-hidden p-0"
      role="dialog"
      aria-modal={true}
      aria-labelledby="dup-day-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
        <div className="shrink-0 border-b border-tt-line-soft p-4">
          <h2
            id="dup-day-title"
            className="font-heading text-lg font-semibold text-tt-royal"
          >
            Duplicate day
          </h2>
          <div className="mt-3 flex gap-1 rounded-tt-md border border-tt-line-soft bg-tt-surface p-0.5 font-sans text-xs font-semibold">
            <button
              type="button"
              className={`min-h-11 flex-1 rounded-tt-md ${
                tab === "specific"
                  ? "bg-tt-royal text-white shadow-tt-sm"
                  : "text-tt-royal"
              }`}
              onClick={() => setTab("specific")}
            >
              Specific dates
            </button>
            <button
              type="button"
              className={`relative min-h-11 flex-1 rounded-tt-md ${
                tab === "recurring"
                  ? "bg-tt-royal text-white shadow-tt-sm"
                  : "text-tt-royal"
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
              <p className="font-sans text-xs text-tt-royal/70">
                Choose dates inside your trip (excluding this day).
              </p>
              <p className="mt-2 font-sans text-sm font-semibold text-tt-royal">
                Copy to {picked.size} day{picked.size === 1 ? "" : "s"}
              </p>
              <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-tt-md border border-tt-line-soft bg-white/80 p-2">
                {selectableDates.map((k) => (
                  <label
                    key={k}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 font-sans text-sm text-tt-royal hover:bg-tt-royal-soft"
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
              <p className="font-sans text-xs text-tt-royal/70">
                Pick weekdays — we only include dates inside your trip range.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEK.map(({ dow, label }) => (
                  <button
                    key={dow}
                    type="button"
                    className={`min-h-11 min-w-[2.75rem] rounded-tt-md border px-2 font-sans text-xs font-semibold ${
                      weekdays.has(dow)
                        ? "border-tt-royal bg-tt-royal text-white"
                        : "border-tt-line bg-white text-tt-royal"
                    }`}
                    onClick={() => toggleWeekday(dow)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-3 font-sans text-xs font-semibold text-tt-royal">
                Preview ({recurringPreview.length})
              </p>
              <ul className="mt-1 max-h-36 overflow-y-auto font-mono text-xs text-tt-royal/80">
                {recurringPreview.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-4 flex rounded-tt-md border border-tt-line-soft bg-tt-surface p-0.5 font-sans text-xs font-semibold">
            <button
              type="button"
              className={`min-h-11 flex-1 rounded-tt-md ${
                merge === "append"
                  ? "bg-tt-royal text-white shadow-tt-sm"
                  : "text-tt-royal"
              }`}
              onClick={() => setMerge("append")}
            >
              Append
            </button>
            <button
              type="button"
              className={`min-h-11 flex-1 rounded-tt-md ${
                merge === "replace"
                  ? "bg-tt-royal text-white shadow-tt-sm"
                  : "text-tt-royal"
              }`}
              onClick={() => setMerge("replace")}
            >
              Replace
            </button>
          </div>
        </div>

        <div className="shrink-0 flex flex-wrap gap-2 border-t border-tt-line-soft p-4">
          <Button
            type="button"
            variant="primary"
            className="min-h-11 flex-1"
            disabled={busy || targets.length === 0}
            onClick={() => void submit()}
          >
            Duplicate →
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
    </ModalShell>
    <BookingConflictModal
      open={replaceDayAnchors != null}
      dayDate={replaceDayAnchors?.targets[0] ?? sourceDate}
      action="day-replace"
      anchors={replaceDayAnchors?.anchors ?? []}
      onKeepBooking={() => setReplaceDayAnchors(null)}
      onDismiss={() => setReplaceDayAnchors(null)}
      onProceedKeepBooking={() => {
        const g = replaceDayAnchors;
        if (!g) return;
        setReplaceDayAnchors(null);
        void runDuplicateRequest(g.targets, merge);
      }}
      onProceedClearBooking={() => {
        const g = replaceDayAnchors;
        if (!g) return;
        setReplaceDayAnchors(null);
        void (async () => {
          for (const d of g.targets) {
            const rows = ridePrioritiesByDay[d] ?? [];
            for (const r of rows) {
              if (!r.skip_line_return_hhmm?.trim()) continue;
              await updateRidePriorityMeta(tripId, r.attraction_id, d, {
                skipLineReturnHhmm: null,
              });
            }
          }
          await runDuplicateRequest(g.targets, merge);
        })();
      }}
    />
    </>
  );
}
