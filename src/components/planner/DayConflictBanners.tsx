"use client";

import {
  dayConflictDismissKey,
  type DayConflict,
} from "@/lib/planner-day-conflicts";
import { useCallback, useEffect, useId, useState } from "react";

type Props = {
  tripId: string;
  dayDate: string;
  conflicts: DayConflict[];
  onAskTripp: () => void;
};

function bannerMessage(c: DayConflict): string {
  switch (c.type) {
    case "time_overlap":
      return `Time overlap — ${c.slotA} and ${c.slotB} both planned around ${c.time}.`;
    case "day_overrun": {
      const hours = Math.round((c.estimatedMinutes / 60) * 10) / 10;
      return `This day looks packed — around ${hours} h of planned activity (over 14 h).`;
    }
    case "empty_must_do":
      return `No must-dos set for ${c.parkName}.`;
    default:
      return "";
  }
}

export function DayConflictBanners({
  tripId,
  dayDate,
  conflicts,
  onAskTripp,
}: Props) {
  const statusId = useId();
  const [expanded, setExpanded] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());

  const sessionKey = useCallback(
    (c: DayConflict) => {
      switch (c.type) {
        case "time_overlap":
          return `${tripId}:${dayDate}:time_overlap:${c.slotA}:${c.slotB}:${c.time}`;
        case "day_overrun":
          return `${tripId}:${dayDate}:day_overrun`;
        case "empty_must_do":
          return `${tripId}:${dayDate}:empty_must_do:${c.parkId}`;
        default:
          return `${tripId}:${dayDate}:${dayConflictDismissKey(c)}`;
      }
    },
    [tripId, dayDate],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = new Set<string>();
    for (const c of conflicts) {
      if (sessionStorage.getItem(sessionKey(c)) === "1") {
        next.add(dayConflictDismissKey(c));
      }
    }
    setHiddenKeys(next);
  }, [tripId, dayDate, conflicts, sessionKey]);

  const visible = conflicts.filter((c) => !hiddenKeys.has(dayConflictDismissKey(c)));

  const dismiss = useCallback(
    (c: DayConflict) => {
      sessionStorage.setItem(sessionKey(c), "1");
      setExpanded(false);
      setHiddenKeys((prev) => new Set(prev).add(dayConflictDismissKey(c)));
    },
    [sessionKey],
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
          key={dayConflictDismissKey(c)}
          className={`relative rounded-lg border px-3 py-2.5 pr-10 font-sans text-sm leading-snug ${
            c.type === "empty_must_do"
              ? "border-royal/15 bg-royal/[0.04] text-royal/85"
              : "border-amber-300/80 bg-amber-50/90 text-amber-950"
          }`}
        >
          <p className="break-words">{bannerMessage(c)}</p>
          {c.type === "empty_must_do" ? (
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
