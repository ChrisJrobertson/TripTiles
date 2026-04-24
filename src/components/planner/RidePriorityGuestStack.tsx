"use client";

import { SkipLineReturnTimeField } from "@/components/planner/SkipLineReturnTimeField";
import { showToast } from "@/lib/toast";
import type { TripRidePriority } from "@/types/attractions";
import { useCallback, useEffect, useId, useState } from "react";

type Props = {
  row: TripRidePriority;
  hasSkipLine: boolean;
  disabled: boolean;
  compact?: boolean;
  onSaveReturn: (next: string | null) => void;
  onSaveNote: (next: string | null) => void;
  onSavePasted: (next: number | null) => void;
  /** Warning line from clash detection; informational only. */
  clashMessage?: string | null;
};

/**
 * Return time, free-text note, and optional “pasted wait” minutes (board snapshot).
 */
export function RidePriorityGuestStack({
  row,
  hasSkipLine,
  disabled,
  compact = false,
  onSaveReturn,
  onSaveNote,
  onSavePasted,
  clashMessage,
}: Props) {
  const noteId = useId();
  const waitId = useId();
  const [noteDraft, setNoteDraft] = useState(() => row.notes ?? "");
  const [pastedDraft, setPastedDraft] = useState(
    () => (row.pasted_queue_minutes != null ? String(row.pasted_queue_minutes) : ""),
  );

  useEffect(() => {
    setNoteDraft(row.notes ?? "");
  }, [row.notes]);

  useEffect(() => {
    setPastedDraft(
      row.pasted_queue_minutes != null ? String(row.pasted_queue_minutes) : "",
    );
  }, [row.pasted_queue_minutes]);

  const commitNote = useCallback(() => {
    const t = noteDraft.trim();
    const next = t === "" ? null : t.slice(0, 500);
    const prev = (row.notes ?? "").trim() || null;
    const n = t === "" ? null : t.slice(0, 500);
    if (n === prev) return;
    onSaveNote(next);
  }, [noteDraft, onSaveNote, row.notes]);

  const commitPasted = useCallback(() => {
    const t = pastedDraft.trim();
    let next: number | null;
    if (t === "") {
      next = null;
    } else {
      const n = parseInt(t, 10);
      if (Number.isNaN(n) || n < 0) {
        showToast("Pasted wait must be a number of minutes (0–600).", {
          type: "error",
        });
        setPastedDraft(
          row.pasted_queue_minutes != null
            ? String(row.pasted_queue_minutes)
            : "",
        );
        return;
      }
      next = Math.min(600, n) || null;
    }
    const prev =
      row.pasted_queue_minutes == null || row.pasted_queue_minutes === 0
        ? null
        : row.pasted_queue_minutes;
    if (next === prev) return;
    onSavePasted(next);
  }, [pastedDraft, onSavePasted, row.pasted_queue_minutes]);

  const wrap = compact ? "mt-0.5 space-y-1" : "mt-1 space-y-1.5";

  return (
    <div className={wrap}>
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={noteId}
          className="font-sans text-[10px] font-medium uppercase tracking-wide text-royal/50"
        >
          Note
        </label>
        <input
          id={noteId}
          type="text"
          value={noteDraft}
          disabled={disabled}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={commitNote}
          maxLength={500}
          placeholder="e.g. VQ, child swap…"
          className={
            compact
              ? "min-h-7 w-full rounded border border-royal/15 bg-white px-1.5 font-sans text-[11px] text-royal"
              : "min-h-8 w-full rounded border border-royal/15 bg-white px-2 font-sans text-xs text-royal"
          }
        />
      </div>
      <SkipLineReturnTimeField
        compact={compact}
        hasSkipLine={hasSkipLine}
        value={row.skip_line_return_hhmm}
        onSave={onSaveReturn}
        disabled={disabled}
        clashMessage={clashMessage}
      />
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={waitId}
          className="font-sans text-[10px] font-medium uppercase tracking-wide text-royal/50"
        >
          Pasted wait (min)
        </label>
        <input
          id={waitId}
          type="text"
          inputMode="numeric"
          value={pastedDraft}
          disabled={disabled}
          onChange={(e) => setPastedDraft(e.target.value.replace(/[^\d]/g, ""))}
          onBlur={commitPasted}
          maxLength={3}
          placeholder="Board / app snapshot"
          title="Not live — heuristics and Smart Plan context only"
          className={
            compact
              ? "h-7 w-20 rounded border border-royal/15 bg-white px-1.5 font-sans text-[11px] text-royal"
              : "h-8 w-24 rounded border border-royal/15 bg-white px-2 font-sans text-xs text-royal"
          }
        />
      </div>
    </div>
  );
}
