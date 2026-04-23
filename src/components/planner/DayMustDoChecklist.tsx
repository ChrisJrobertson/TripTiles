"use client";

import { useCallback, useEffect, useState } from "react";

function storageKey(tripId: string, dateKey: string, index: number): string {
  return `trip_${tripId}_day_${dateKey}_must_do_${index}`;
}

type Props = {
  tripId: string;
  dateKey: string;
  items: string[];
};

/**
 * v1: checkbox state in localStorage only (no server sync).
 */
export function DayMustDoChecklist({ tripId, dateKey, items }: Props) {
  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setChecked(items.map(() => false));
      return;
    }
    setChecked(
      items.map(
        (_, i) => localStorage.getItem(storageKey(tripId, dateKey, i)) === "1",
      ),
    );
  }, [tripId, dateKey, items]);

  const toggle = useCallback(
    (index: number) => {
      setChecked((prev) => {
        const next = items.map(
          (_, i) => (i === index ? !prev[i] : Boolean(prev[i])),
        );
        for (let i = 0; i < next.length; i += 1) {
          localStorage.setItem(
            storageKey(tripId, dateKey, i),
            next[i] ? "1" : "0",
          );
        }
        return next;
      });
    },
    [tripId, dateKey, items],
  );

  if (items.length === 0) return null;

  return (
    <aside
      className="rounded-lg border-[0.5px] border-royal/15 bg-white/95 p-3.5 shadow-sm dark:border-white/10 dark:bg-neutral-900/30"
      aria-label="Must-do list"
    >
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.5px] text-royal/60 dark:text-neutral-200/80">
        Must-do
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
              checked={checked[i] ?? false}
              onChange={() => toggle(i)}
            />
            <span className="min-w-0 font-sans text-sm leading-snug text-royal/90 dark:text-neutral-100">
              {line}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
