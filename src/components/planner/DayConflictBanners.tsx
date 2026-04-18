"use client";

import type { PlannerDayConflict } from "@/lib/planner-day-conflicts";
import { useCallback, useEffect, useId, useState } from "react";

type Props = {
  tripId: string;
  dayDate: string;
  conflicts: PlannerDayConflict[];
  onAskTripp: () => void;
};

export function DayConflictBanners({
  tripId,
  dayDate,
  conflicts,
  onAskTripp,
}: Props) {
  const statusId = useId();
  const [expanded, setExpanded] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = new Set<string>();
    for (const c of conflicts) {
      const k = `${tripId}:${dayDate}:${c.dismissKey}`;
      if (sessionStorage.getItem(k) === "1") next.add(c.dismissKey);
    }
    setHiddenKeys(next);
  }, [tripId, dayDate, conflicts]);

  const visible = conflicts.filter((c) => !hiddenKeys.has(c.dismissKey));

  const dismiss = useCallback(
    (c: PlannerDayConflict) => {
      const k = `${tripId}:${dayDate}:${c.dismissKey}`;
      sessionStorage.setItem(k, "1");
      setExpanded(false);
      setHiddenKeys((prev) => new Set(prev).add(c.dismissKey));
    },
    [tripId, dayDate],
  );

  if (visible.length === 0) return null;

  const max = expanded ? visible.length : Math.min(3, visible.length);
  const shown = visible.slice(0, max);
  const more = visible.length - shown.length;

  return (
    <div
      id={statusId}
      role="status"
      aria-live="polite"
      className="mb-3 flex flex-col gap-2"
    >
      {shown.map((c) => (
        <div
          key={c.dismissKey}
          className={`relative rounded-lg border px-3 py-2.5 pr-10 font-sans text-sm leading-snug ${
            c.kind === "empty_must_do"
              ? "border-royal/15 bg-royal/[0.04] text-royal/85"
              : "border-amber-300/80 bg-amber-50/90 text-amber-950"
          }`}
        >
          <p>{c.message}</p>
          {c.kind === "empty_must_do" ? (
            <button
              type="button"
              className="mt-2 min-h-11 rounded-lg border border-royal/20 bg-white px-3 font-sans text-xs font-semibold text-royal"
              onClick={onAskTripp}
            >
              Ask Tripp →
            </button>
          ) : null}
          <button
            type="button"
            className="absolute right-2 top-2 flex min-h-9 min-w-9 items-center justify-center rounded text-lg leading-none text-royal/50 hover:bg-black/5"
            aria-label="Dismiss"
            onClick={() => dismiss(c)}
          >
            ×
          </button>
        </div>
      ))}
      {!expanded && more > 0 ? (
        <button
          type="button"
          className="min-h-11 rounded-lg border border-royal/15 bg-white px-3 text-left font-sans text-xs font-semibold text-royal"
          onClick={() => setExpanded(true)}
        >
          + {more} more issues
        </button>
      ) : null}
    </div>
  );
}
