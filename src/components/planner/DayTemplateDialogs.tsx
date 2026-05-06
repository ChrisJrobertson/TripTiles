"use client";

import { updateRidePriorityMeta } from "@/actions/ride-priorities";
import { BookingConflictModal } from "@/components/planner/BookingConflictModal";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
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
    <ModalShell
      zClassName="z-[120]"
      bottomSheetOnMobile
      overlayClassName="bg-tt-royal/50 backdrop-blur-[1px]"
      maxWidthClass="max-w-md"
      panelClassName="p-5 sm:p-6"
      role="dialog"
      aria-modal={true}
      aria-labelledby="save-tpl-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
        <h2
          id="save-tpl-title"
          className="font-heading text-lg font-semibold text-tt-royal"
        >
          Save as template
        </h2>
        <label className="mt-3 block font-sans text-xs font-medium text-tt-royal/70">
          Template name
          <input
            className="mt-1 min-h-11 w-full rounded-tt-md border border-tt-line bg-white px-3 font-sans text-sm text-tt-royal"
            placeholder="e.g. Typical MK Day"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-tt-line-soft pt-4">
          <Button
            type="button"
            variant="primary"
            className="min-h-11 flex-1"
            disabled={busy || !name.trim()}
            onClick={() => void save()}
          >
            Save
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
    <ModalShell
      zClassName="z-[120]"
      bottomSheetOnMobile
      overlayClassName="bg-tt-royal/50 backdrop-blur-[1px]"
      maxWidthClass="max-w-md"
      panelClassName="flex max-h-[min(85vh,36rem)] flex-col overflow-hidden p-0"
      role="dialog"
      aria-modal={true}
      aria-labelledby="apply-tpl-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
        <div className="shrink-0 border-b border-tt-line-soft p-4">
          <h2
            id="apply-tpl-title"
            className="font-heading text-lg font-semibold text-tt-royal"
          >
            Apply template
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          <ul className="divide-y divide-tt-line-soft">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`flex w-full min-h-11 flex-col items-start gap-0.5 py-2 text-left font-sans text-sm ${
                    selectedId === t.id ? "text-tt-royal" : "text-tt-royal/80"
                  }`}
                  onClick={() => setSelectedId(t.id)}
                >
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-xs text-tt-royal/55">
                    {t.is_seed ? (
                      <span className="mr-2 rounded bg-tt-gold/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase">
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
        <div className="shrink-0 space-y-3 border-t border-tt-line-soft p-4">
          <div className="flex rounded-tt-md border border-tt-line-soft bg-tt-surface p-0.5 font-sans text-xs font-semibold">
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              className="min-h-11 flex-1"
              disabled={busy || !selectedId}
              onClick={() => apply()}
            >
              Apply
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
        </div>
    </ModalShell>
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
