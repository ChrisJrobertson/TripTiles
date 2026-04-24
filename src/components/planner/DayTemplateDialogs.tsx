"use client";

import { updateRidePriorityMeta } from "@/actions/ride-priorities";
import { BookingConflictModal } from "@/components/planner/BookingConflictModal";
import {
  anchorsOnTargetDay,
  type BookingAnchor,
} from "@/lib/booking-anchor-risk";
import { formatUndoSnapshotHint } from "@/lib/date-helpers";
import type { DayTemplatePayload } from "@/types/day-template";
import type { Tier } from "@/lib/tier";
import type { Park, Trip } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import { sortPrioritiesForDay } from "@/lib/ride-plan-display";
import { plannerUserDayNotes } from "@/lib/planner-note-maps";
import { useCallback, useEffect, useMemo, useState } from "react";

type TemplateRow = {
  id: string;
  name: string;
  is_seed: boolean;
  created_at: string;
};

export function SaveTemplateDialog({
  open,
  onClose,
  trip,
  dayDate,
  ridePriorities,
  productTier,
  onLocked,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  dayDate: string;
  ridePriorities: TripRidePriority[];
  productTier: Tier;
  onLocked: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  const save = useCallback(async () => {
    if (productTier === "free") {
      onLocked();
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const dayAss = trip.assignments[dayDate] ?? {};
      const notes = plannerUserDayNotes(trip);
      const sorted = sortPrioritiesForDay(
        ridePriorities.filter((p) => p.day_date === dayDate),
      );
      const ridePrioritiesPayload: DayTemplatePayload["ridePriorities"] =
        sorted.map((p, i) => ({
          attractionId: p.attraction_id,
          label: p.attraction?.name ?? undefined,
          priority: p.priority,
          sortOrder: i,
          notes: p.notes ?? null,
          skipLineReturnHhmm: p.skip_line_return_hhmm ?? null,
          pastedQueueMinutes: p.pasted_queue_minutes ?? null,
        }));
      const payload: DayTemplatePayload = {
        version: 1,
        assignments: {
          ...(dayAss.am != null ? { am: dayAss.am } : {}),
          ...(dayAss.pm != null ? { pm: dayAss.pm } : {}),
          ...(dayAss.lunch != null ? { lunch: dayAss.lunch } : {}),
          ...(dayAss.dinner != null ? { dinner: dayAss.dinner } : {}),
        },
        ridePriorities: ridePrioritiesPayload,
        dayNote: notes[dayDate]?.trim() || null,
      };
      const res = await fetch("/api/day-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, payload }),
      });
      if (res.status === 403) {
        onLocked();
        return;
      }
      if (!res.ok) throw new Error();
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }, [
    productTier,
    name,
    trip,
    dayDate,
    ridePriorities,
    onLocked,
    onSaved,
    onClose,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-royal/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-tpl-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-royal/15 bg-cream p-4 shadow-2xl sm:rounded-2xl">
        <h2
          id="save-tpl-title"
          className="font-serif text-lg font-semibold text-royal"
        >
          Save as template
        </h2>
        <label className="mt-3 block font-sans text-xs font-medium text-royal/70">
          Template name
          <input
            className="mt-1 min-h-11 w-full rounded-lg border border-royal/20 bg-white px-3 font-sans text-sm text-royal"
            placeholder="e.g. Typical MK Day"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="min-h-11 flex-1 rounded-lg bg-royal px-4 font-sans text-sm font-semibold text-cream disabled:opacity-50"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
          >
            Save
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

export function ApplyTemplateDialog({
  open,
  onClose,
  tripId,
  dayDate,
  productTier,
  rideRowsForTargetDay,
  parks,
  onLocked,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  dayDate: string;
  productTier: Tier;
  rideRowsForTargetDay: TripRidePriority[];
  parks: Park[];
  onLocked: () => void;
  onApplied: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [merge, setMerge] = useState<"append" | "replace">("append");
  const [busy, setBusy] = useState(false);
  const [replaceTemplateAnchors, setReplaceTemplateAnchors] = useState<
    BookingAnchor[] | null
  >(null);

  const parkById = useMemo(
    () => new Map(parks.map((p) => [p.id, p] as const)),
    [parks],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/day-templates");
        if (res.status === 403) {
          if (!cancelled) onLocked();
          return;
        }
        const data = (await res.json()) as { templates?: TemplateRow[] };
        if (!cancelled) {
          setTemplates(data.templates ?? []);
          setSelectedId((data.templates ?? [])[0]?.id ?? null);
        }
      } catch {
        if (!cancelled) setTemplates([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, onLocked]);

  useEffect(() => {
    if (!open) setReplaceTemplateAnchors(null);
  }, [open]);

  const runApplyRequest = useCallback(
    async (mergeMode: "append" | "replace") => {
      if (productTier === "free") {
        onLocked();
        return;
      }
      if (!selectedId) return;
      setBusy(true);
      try {
        const res = await fetch(`/api/day-templates/${selectedId}/apply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, date: dayDate, merge: mergeMode }),
        });
        if (res.status === 403) {
          onLocked();
          return;
        }
        if (!res.ok) throw new Error();
        onApplied();
        onClose();
      } finally {
        setBusy(false);
      }
    },
    [productTier, selectedId, tripId, dayDate, onLocked, onApplied, onClose],
  );

  const apply = useCallback(() => {
    if (productTier === "free") {
      onLocked();
      return;
    }
    if (!selectedId) return;
    if (merge === "replace") {
      const at = anchorsOnTargetDay(rideRowsForTargetDay, parkById);
      if (at.length > 0) {
        setReplaceTemplateAnchors(at);
        return;
      }
    }
    void runApplyRequest(merge);
  }, [
    productTier,
    selectedId,
    merge,
    rideRowsForTargetDay,
    parkById,
    onLocked,
    runApplyRequest,
  ]);

  if (!open) return null;

  return (
    <>
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-royal/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-tpl-title"
    >
      <button
        type="button"
        className="absolute inset-0 z-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(85vh,36rem)] w-full max-w-md flex-col rounded-t-2xl border border-royal/15 bg-cream shadow-2xl sm:rounded-2xl">
        <div className="shrink-0 border-b border-royal/10 p-4">
          <h2
            id="apply-tpl-title"
            className="font-serif text-lg font-semibold text-royal"
          >
            Apply template
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          <ul className="divide-y divide-royal/10">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`flex w-full min-h-11 flex-col items-start gap-0.5 py-2 text-left font-sans text-sm ${
                    selectedId === t.id ? "text-royal" : "text-royal/80"
                  }`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-xs text-royal/55">
                    {t.is_seed ? (
                      <span className="mr-2 rounded bg-gold/25 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
                        Seed
                      </span>
                    ) : null}
                    {formatUndoSnapshotHint(t.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 space-y-3 border-t border-royal/10 p-4">
          <div className="flex rounded-lg border border-royal/15 p-0.5 font-sans text-xs font-semibold">
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
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 flex-1 rounded-lg bg-royal px-4 font-sans text-sm font-semibold text-cream disabled:opacity-50"
              disabled={busy || !selectedId}
              onClick={() => apply()}
            >
              Apply
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
    </div>
    <BookingConflictModal
      open={replaceTemplateAnchors != null}
      dayDate={dayDate}
      action="day-replace"
      anchors={replaceTemplateAnchors ?? []}
      onKeepBooking={() => setReplaceTemplateAnchors(null)}
      onDismiss={() => setReplaceTemplateAnchors(null)}
      onProceedKeepBooking={() => {
        const a = replaceTemplateAnchors;
        if (!a) return;
        setReplaceTemplateAnchors(null);
        void runApplyRequest(merge);
      }}
      onProceedClearBooking={() => {
        const a = replaceTemplateAnchors;
        if (!a) return;
        setReplaceTemplateAnchors(null);
        void (async () => {
          for (const anchor of a) {
            await updateRidePriorityMeta(
              tripId,
              anchor.attractionId,
              dayDate,
              { skipLineReturnHhmm: null },
            );
          }
          await runApplyRequest(merge);
        })();
      }}
    />
    </>
  );
}
