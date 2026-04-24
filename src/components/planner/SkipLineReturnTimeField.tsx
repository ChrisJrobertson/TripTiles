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
  /** Tooltip + optional mobile line; from clash detection. */
  clashMessage?: string | null;
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
function ClashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 3L2 20h20L12 3z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 9v4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function SkipLineReturnTimeField({
  value,
  onSave,
  disabled = false,
  hasSkipLine,
  compact = false,
  clashMessage = null,
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

  const clash = clashMessage?.trim() ?? null;

  return (
    <div
      className={
        compact
          ? "flex min-w-0 flex-col gap-0.5"
          : "mt-1 flex min-w-0 flex-col gap-0.5"
      }
    >
      <div
        className={
          compact
            ? "flex shrink-0 items-center gap-1"
            : "flex flex-wrap items-center gap-1.5"
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
        {clash ? (
          <span title={clash} className="shrink-0 text-amber-700">
            <ClashIcon className="text-amber-700" />
          </span>
        ) : null}
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
      {clash ? (
        <p
          className="line-clamp-2 max-w-full font-sans text-[10px] leading-snug text-amber-800/90 sm:hidden"
          title={clash}
        >
          {clash}
        </p>
      ) : null}
    </div>
  );
}
