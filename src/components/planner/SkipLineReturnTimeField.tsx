"use client";

import {
  normalizeSkipLineReturnHhmm,
  timeInputValueFromHhmm,
} from "@/lib/skip-line-return-hhmm";
import { showToast } from "@/lib/toast";
import { useCallback, useEffect, useId, useState } from "react";

type Props = {
  value: string | null;
  onSave: (next: string | null) => void;
  disabled?: boolean;
  hasSkipLine: boolean;
  /** Single-line ride row (tighter). */
  compact?: boolean;
};

function normalizedOrNull(
  v: string | null | undefined,
): string | null {
  if (v == null || !String(v).trim()) return null;
  try {
    return normalizeSkipLineReturnHhmm(String(v).trim());
  } catch {
    return null;
  }
}

/**
 * 24h time picker for Lightning Lane / Express return windows. Hidden when the
 * attraction has no skip-line product in the catalogue.
 */
export function SkipLineReturnTimeField({
  value,
  onSave,
  disabled = false,
  hasSkipLine,
  compact = false,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState(() => timeInputValueFromHhmm(value));

  useEffect(() => {
    setDraft(timeInputValueFromHhmm(value));
  }, [value]);

  const commitIfChanged = useCallback(() => {
    const prev = normalizedOrNull(value);
    let next: string | null;
    try {
      next = draft.trim() === "" ? null : normalizeSkipLineReturnHhmm(draft);
    } catch {
      setDraft(timeInputValueFromHhmm(value));
      showToast("Enter a valid 24h time (HH:mm).", { type: "error" });
      return;
    }
    if (next === prev) return;
    onSave(next);
  }, [value, draft, onSave]);

  if (!hasSkipLine) return null;

  return (
    <div
      className={
        compact
          ? "flex shrink-0 items-center gap-1"
          : "mt-1 flex flex-wrap items-center gap-1.5"
      }
    >
      <label
        htmlFor={id}
        className="shrink-0 font-sans text-[10px] font-medium uppercase tracking-wide text-royal/55"
      >
        Return
      </label>
      <input
        id={id}
        type="time"
        step={60}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitIfChanged}
        className={
          compact
            ? "h-7 min-w-0 max-w-[6.5rem] rounded border border-royal/20 bg-white px-1.5 font-sans text-[11px] text-royal"
            : "h-8 min-w-0 max-w-[6.5rem] rounded border border-royal/20 bg-white px-2 font-sans text-xs text-royal"
        }
        title="Skip-the-line return or booking time (24h, local park time)"
      />
      {normalizedOrNull(value) ? (
        <button
          type="button"
          disabled={disabled}
          className="shrink-0 font-sans text-[10px] text-royal/50 underline decoration-royal/30 underline-offset-2 disabled:opacity-40"
          onClick={() => {
            setDraft("");
            onSave(null);
          }}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
