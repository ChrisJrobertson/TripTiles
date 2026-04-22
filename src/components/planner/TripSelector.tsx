"use client";

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
      className={`flex flex-col gap-3 rounded-xl border border-royal/12 bg-white/90 px-4 py-3 shadow-md shadow-royal/[0.06] ring-1 ring-gold/15 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5 sm:py-4 ${className}`}
    >
      <label className="flex flex-wrap items-center gap-3 font-sans text-base text-royal">
        <span
          className="select-none text-3xl leading-none sm:text-4xl"
          aria-hidden
        >
          🎢
        </span>
        <span className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold">Current trip:</span>
          <select
            value={activeTripId}
            onChange={(e) => onSwitch(e.target.value)}
            className="min-h-12 min-w-[min(100%,14rem)] flex-1 rounded-lg border border-royal/25 bg-white px-3 py-2.5 text-base text-royal sm:min-w-[16rem]"
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
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg border border-royal/30 bg-white px-3 py-2 font-sans text-sm font-medium text-royal hover:border-gold"
        >
          + New
        </button>
        <button
          type="button"
          onClick={onRename}
          className="rounded-lg border border-royal/30 bg-white px-3 py-2 font-sans text-sm font-medium text-royal hover:border-gold"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={onlyOne}
          className="rounded-lg border border-red-200 bg-white px-3 py-2 font-sans text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
