"use client";

import type { Trip } from "@/lib/types";

type Props = {
  trips: Trip[];
  activeTripId: string;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
};

export function TripSelector({
  trips,
  activeTripId,
  onSwitch,
  onNew,
  onRename,
  onDelete,
}: Props) {
  const onlyOne = trips.length <= 1;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gold/50 bg-cream/80 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <label className="flex flex-wrap items-center gap-2 font-sans text-sm text-royal">
        <span className="font-medium">Current trip:</span>
        <select
          value={activeTripId}
          onChange={(e) => onSwitch(e.target.value)}
          className="min-h-11 min-w-[12rem] rounded-lg border border-royal/25 bg-white px-3 py-2 text-sm text-royal"
        >
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.family_name} — {t.adventure_name}
            </option>
          ))}
        </select>
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
