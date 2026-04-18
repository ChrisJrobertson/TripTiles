"use client";

import {
  getAttractionsForPark,
  getRidePrioritiesForDay,
  removeRidePriority,
  reorderRidePriorities,
  toggleRidePriority,
} from "@/actions/ride-priorities";
import { SkipLineLegend } from "@/components/planner/SkipLineLegend";
import { parseDate } from "@/lib/date-helpers";
import type { Park } from "@/lib/types";
import {
  buildLightningLaneStrategyBlurb,
  heightCheckLines,
  skipLineBadgeLabel,
  skipLineBadgeStyle,
  sortPrioritiesForDay,
  thrillEmoji,
  waitMinutesColourClass,
} from "@/lib/ride-plan-display";
import type { Attraction, TripRidePriority } from "@/types/attractions";
import { useCallback, useEffect, useMemo, useState } from "react";

export type ExpandedDayPanelProps = {
  tripId: string;
  dayDate: string;
  parkIds: string[];
  childAges: number[];
  ridePriorities: TripRidePriority[];
  parks: Park[];
  onClose: () => void;
  onPrioritiesUpdated: (items: TripRidePriority[]) => void;
  /** Hides title, close, and legend — used inside Day Detail shell. */
  embedded?: boolean;
};

function formatUkLongDate(dateKey: string): string {
  const d = parseDate(dateKey);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isDisneyParkGroup(g: string): boolean {
  return g === "disney" || g === "disneyextra";
}

function isUniversalParkGroup(g: string): boolean {
  return g === "universal";
}

async function refreshDayPriorities(
  tripId: string,
  dayDate: string,
): Promise<TripRidePriority[]> {
  return getRidePrioritiesForDay(tripId, dayDate);
}

function RideRow({
  row,
  canUp,
  canDown,
  onMoveUp,
  onMoveDown,
  onToggleIcon,
  pending,
}: {
  row: TripRidePriority;
  canUp: boolean;
  canDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleIcon: () => void;
  pending: boolean;
}) {
  const a = row.attraction;
  if (!a) return null;
  const badge = skipLineBadgeLabel(a.skip_line_tier);
  const badgeStyle = skipLineBadgeStyle(a.skip_line_tier);
  const peak = a.avg_wait_peak_minutes;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E1D8]/80 py-2 font-sans text-xs text-royal last:border-b-0 sm:text-[13px]">
      <button
        type="button"
        disabled={pending}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-royal/15 bg-white text-base leading-none text-royal hover:bg-cream disabled:opacity-50"
        aria-label={
          row.priority === "must_do"
            ? "Move to if time"
            : "Remove from plan"
        }
        onClick={onToggleIcon}
      >
        {row.priority === "must_do" ? "★" : "○"}
      </button>
      <span className="min-w-0 flex-1 font-medium leading-snug">{a.name}</span>
      <span className="flex shrink-0 gap-0.5">
        <button
          type="button"
          disabled={pending || !canUp}
          className="flex h-9 w-9 items-center justify-center rounded border border-royal/15 bg-white text-sm text-royal hover:bg-cream disabled:opacity-30"
          aria-label="Move up"
          onClick={onMoveUp}
        >
          ↑
        </button>
        <button
          type="button"
          disabled={pending || !canDown}
          className="flex h-9 w-9 items-center justify-center rounded border border-royal/15 bg-white text-sm text-royal hover:bg-cream disabled:opacity-30"
          aria-label="Move down"
          onClick={onMoveDown}
        >
          ↓
        </button>
      </span>
      {badge ? (
        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
          style={badgeStyle}
          title={a.skip_line_notes ?? undefined}
        >
          ⚡{badge}
        </span>
      ) : null}
      {peak != null ? (
        <span
          className={`shrink-0 font-semibold ${waitMinutesColourClass(peak)}`}
        >
          {peak} min
        </span>
      ) : null}
      <span className="shrink-0 text-base" aria-hidden>
        {thrillEmoji(a.thrill_level)}
      </span>
      <span className="shrink-0 capitalize text-royal/70">{a.thrill_level}</span>
      {a.height_requirement_cm != null ? (
        <span className="shrink-0 text-royal/65">{a.height_requirement_cm} cm</span>
      ) : null}
    </div>
  );
}

export function ExpandedDayPanel({
  tripId,
  dayDate,
  parkIds,
  childAges,
  ridePriorities,
  parks,
  onClose,
  onPrioritiesUpdated,
  embedded = false,
}: ExpandedDayPanelProps) {
  const [catalog, setCatalog] = useState<Attraction[]>([]);
  const [pending, setPending] = useState(false);

  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);

  const sorted = useMemo(
    () => sortPrioritiesForDay(ridePriorities),
    [ridePriorities],
  );

  const mustRows = sorted.filter((r) => r.priority === "must_do");
  const ifRows = sorted.filter((r) => r.priority === "if_time");

  const parkLabels = useMemo(() => {
    const names = parkIds
      .map((id) => parkById.get(id)?.name)
      .filter(Boolean) as string[];
    if (names.length === 0) return "";
    if (names.length === 1) return names[0]!;
    return names.join(" & ");
  }, [parkById, parkIds]);

  const parkHasDisney = useMemo(
    () =>
      parkIds.some((id) => {
        const g = parkById.get(id)?.park_group ?? "";
        return isDisneyParkGroup(g);
      }),
    [parkById, parkIds],
  );

  const parkHasUniversal = useMemo(
    () =>
      parkIds.some((id) => {
        const g = parkById.get(id)?.park_group ?? "";
        return isUniversalParkGroup(g);
      }),
    [parkById, parkIds],
  );

  useEffect(() => {
    if (parkIds.length === 0) {
      setCatalog([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const lists = await Promise.all(
        parkIds.map((id) => getAttractionsForPark(id)),
      );
      if (cancelled) return;
      const merged = new Map<string, Attraction>();
      for (const list of lists) {
        for (const a of list) merged.set(a.id, a);
      }
      setCatalog(
        [...merged.values()].sort(
          (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [parkIds]);

  const selectedIds = useMemo(
    () => new Set(ridePriorities.map((r) => r.attraction_id)),
    [ridePriorities],
  );

  const available = useMemo(
    () => catalog.filter((a) => !selectedIds.has(a.id)),
    [catalog, selectedIds],
  );

  const mustAttractions = useMemo(
    () => mustRows.map((r) => r.attraction).filter(Boolean) as Attraction[],
    [mustRows],
  );

  const strategy = useMemo(
    () =>
      buildLightningLaneStrategyBlurb(
        mustAttractions,
        parkHasDisney,
        parkHasUniversal,
      ),
    [mustAttractions, parkHasDisney, parkHasUniversal],
  );

  const selectedAttractionsForHeight = useMemo(() => {
    const out: Attraction[] = [];
    for (const r of sorted) {
      if (r.attraction) out.push(r.attraction);
    }
    return out;
  }, [sorted]);

  const heightLines = useMemo(
    () => heightCheckLines(childAges, selectedAttractionsForHeight),
    [childAges, selectedAttractionsForHeight],
  );

  const runMutation = useCallback(
    (fn: () => Promise<void>) => {
      void (async () => {
        setPending(true);
        try {
          await fn();
          const next = await refreshDayPriorities(tripId, dayDate);
          onPrioritiesUpdated(next);
        } finally {
          setPending(false);
        }
      })();
    },
    [dayDate, onPrioritiesUpdated, tripId],
  );

  const handleAddAvailable = (attractionId: string) => {
    runMutation(() =>
      toggleRidePriority(tripId, attractionId, dayDate, "must_do"),
    );
  };

  const handleTogglePriorityIcon = (row: TripRidePriority) => {
    if (row.priority === "must_do") {
      runMutation(() =>
        toggleRidePriority(tripId, row.attraction_id, dayDate, "if_time"),
      );
      return;
    }
    runMutation(() =>
      removeRidePriority(tripId, row.attraction_id, dayDate),
    );
  };

  const moveWithinSection = (
    section: "must_do" | "if_time",
    index: number,
    delta: number,
  ) => {
    const sectionRows = section === "must_do" ? mustRows : ifRows;
    const j = index + delta;
    if (j < 0 || j >= sectionRows.length) return;
    const ids = sectionRows.map((r) => r.id);
    const nextIds = [...ids];
    const [removed] = nextIds.splice(index, 1);
    nextIds.splice(j, 0, removed!);
    const other =
      section === "must_do"
        ? ifRows.map((r) => r.id)
        : mustRows.map((r) => r.id);
    const full =
      section === "must_do" ? [...nextIds, ...other] : [...other, ...nextIds];
    runMutation(() => reorderRidePriorities(tripId, dayDate, full));
  };

  if (parkIds.length === 0) {
    return (
      <div
        className={
          embedded
            ? "w-full px-1 py-2"
            : "w-full border-y border-[#E5E1D8] bg-[#FAF8F3] px-3 py-4 sm:px-4"
        }
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-sans text-sm text-royal/75">
            Assign a park in <span className="font-semibold">AM</span> or{" "}
            <span className="font-semibold">PM</span> to plan rides for this
            day.
          </p>
          {!embedded ? (
            <button
              type="button"
              className="shrink-0 rounded px-2 text-royal/60 hover:bg-white/80"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? "w-full bg-transparent px-1 py-1 sm:px-2"
          : "w-full border-y border-[#E5E1D8] bg-[#FAF8F3] px-3 py-3 sm:px-4 sm:py-4"
      }
    >
      {!embedded ? (
        <>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-serif text-base font-bold leading-snug text-royal sm:text-lg">
                📅 {formatUkLongDate(dayDate)}
                {parkLabels ? (
                  <>
                    {" "}
                    — {parkLabels}{" "}
                    <span className="font-sans font-normal text-royal/70">
                      (AM & PM)
                    </span>
                  </>
                ) : null}
              </h3>
            </div>
            <button
              type="button"
              className="shrink-0 rounded px-2 text-lg leading-none text-royal/55 hover:bg-white/80"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div className="mb-3">
            <SkipLineLegend />
          </div>
        </>
      ) : null}

      <div className="mb-3 rounded-lg border border-gold/25 bg-white/70 px-3 py-2">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-royal">
          ⚡ Lightning Lane strategy
        </p>
        <p className="mt-1 font-sans text-xs leading-relaxed text-royal/85">
          {strategy}
        </p>
      </div>

      <div className="mb-2">
        <p className="mb-1 border-b border-royal/15 pb-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-royal">
          Must-do
        </p>
        {mustRows.length === 0 ? (
          <p className="py-2 font-sans text-xs italic text-royal/50">
            No must-dos yet — add from Available below.
          </p>
        ) : (
          mustRows.map((row, i) => (
            <RideRow
              key={row.id}
              row={row}
              canUp={i > 0}
              canDown={i < mustRows.length - 1}
              onMoveUp={() => moveWithinSection("must_do", i, -1)}
              onMoveDown={() => moveWithinSection("must_do", i, 1)}
              onToggleIcon={() => handleTogglePriorityIcon(row)}
              pending={pending}
            />
          ))
        )}
      </div>

      <div className="mb-3">
        <p className="mb-1 border-b border-royal/15 pb-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-royal">
          If time
        </p>
        {ifRows.length === 0 ? (
          <p className="py-2 font-sans text-xs italic text-royal/50">
            Nothing in the if-time list.
          </p>
        ) : (
          ifRows.map((row, i) => (
            <RideRow
              key={row.id}
              row={row}
              canUp={i > 0}
              canDown={i < ifRows.length - 1}
              onMoveUp={() => moveWithinSection("if_time", i, -1)}
              onMoveDown={() => moveWithinSection("if_time", i, 1)}
              onToggleIcon={() => handleTogglePriorityIcon(row)}
              pending={pending}
            />
          ))
        )}
      </div>

      <div className="mb-2">
        <p className="mb-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-royal">
          Available
        </p>
        <div className="flex flex-wrap gap-2">
          {available.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={pending}
              className="rounded-full border border-royal/20 bg-white px-2.5 py-1 font-sans text-[11px] font-medium text-royal shadow-sm transition hover:border-gold/50 hover:bg-cream disabled:opacity-50"
              onClick={() => handleAddAvailable(a.id)}
            >
              + {a.name}
            </button>
          ))}
        </div>
      </div>

      {heightLines.length ? (
        <div className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/80 px-3 py-2 font-sans text-[11px] leading-relaxed text-royal">
          <p className="font-semibold text-amber-900">Height check</p>
          <ul className="mt-1 list-inside list-disc">
            {heightLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
