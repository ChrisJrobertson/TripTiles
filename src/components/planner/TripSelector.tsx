"use client";

import { Button } from "@/components/ui/Button";
import type { Trip } from "@/lib/types";

type Props = {
  trips: Trip[];
  activeTripId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  className?: string;
};

export function TripSelector({
  trips,
  activeTripId,
  onSwitch,
  onNew,
  onRename,
  onDelete,
  className = "",
}: Props) {
  const onlyOne = trips.length <= 1;

  return (
    <div
      className={`flex flex-col gap-3 rounded-tt-lg border border-tt-line bg-tt-surface/95 px-4 py-3 shadow-tt-sm backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`}
    >
      <label className="flex flex-wrap items-center gap-3 font-sans text-sm text-tt-ink">
        <span
          className="select-none text-2xl leading-none sm:text-3xl"
          aria-hidden
        >
          🎢
        </span>
        <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="font-meta text-xs font-semibold uppercase tracking-wide text-tt-ink-soft">
            Current trip
          </span>
          <select
            value={activeTripId}
            onChange={(e) => onSwitch(e.target.value)}
            className="min-h-11 min-w-[min(100%,14rem)] flex-1 rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-sm font-semibold text-tt-royal shadow-tt-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-royal/40 sm:min-w-[16rem]"
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.family_name} — {t.adventure_name}
              </option>
            ))}
          </select>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={onNew}
          variant="secondary"
          size="sm"
        >
          + New
        </Button>
        <Button
          type="button"
          onClick={onRename}
          variant="ghost"
          size="sm"
        >
          Rename
        </Button>
        <Button
          type="button"
          onClick={onDelete}
          disabled={onlyOne}
          variant="danger"
          size="sm"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
