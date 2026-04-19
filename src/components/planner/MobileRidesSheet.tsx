"use client";

import {
  getAttractionsForPark,
  getRidePrioritiesForDay,
  removeRidePriority,
  reorderRidePriorities,
  toggleRidePriority,
} from "@/actions/ride-priorities";
import { TierLimitModal } from "@/components/paywall/TierLimitModal";
import { SkipLineLegend } from "@/components/planner/SkipLineLegend";
import {
  buildLightningLaneStrategyBlurb,
  heightCheckLines,
  skipLineBadgeLabel,
  skipLineBadgeStyle,
  sortPrioritiesForDay,
  thrillEmoji,
  waitMinutesColourClass,
} from "@/lib/ride-plan-display";
import type { Park } from "@/lib/types";
import type { Attraction, TripRidePriority } from "@/types/attractions";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  tripId: string;
  dayDate: string;
  parkIds: string[];
  childAges: number[];
  ridePriorities: TripRidePriority[];
  parks: Park[];
  onPrioritiesUpdated: (items: TripRidePriority[]) => void;
};

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

export function MobileRidesSheet({
  open,
  onClose,
  tripId,
  dayDate,
  parkIds,
  childAges,
  ridePriorities,
  parks,
  onPrioritiesUpdated,
}: Props) {
  const [showLimitModal, setShowLimitModal] = useState(false);
  const titleId = useId();
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<Attraction[]>([]);
  const [pending, setPending] = useState(false);

  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);

  const sorted = useMemo(
    () => sortPrioritiesForDay(ridePriorities),
    [ridePriorities],
  );
  const mustRows = sorted.filter((r) => r.priority === "must_do");
  const ifRows = sorted.filter((r) => r.priority === "if_time");

  const parkHasDisney = useMemo(
    () =>
      parkIds.some((id) => isDisneyParkGroup(parkById.get(id)?.park_group ?? "")),
    [parkById, parkIds],
  );
  const parkHasUniversal = useMemo(
    () =>
      parkIds.some((id) =>
        isUniversalParkGroup(parkById.get(id)?.park_group ?? ""),
      ),
    [parkById, parkIds],
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

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
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
  }, [open, parkIds]);

  const selectedIds = useMemo(
    () => new Set(ridePriorities.map((r) => r.attraction_id)),
    [ridePriorities],
  );

  const availableFiltered = useMemo(() => {
    const avail = catalog.filter((a) => !selectedIds.has(a.id));
    const q = search.trim().toLowerCase();
    if (!q) return avail;
    return avail.filter((a) => a.name.toLowerCase().includes(q));
  }, [catalog, search, selectedIds]);

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
    (fn: () => Promise<unknown>) => {
      void (async () => {
        setPending(true);
        try {
          const result = await fn();
          if (
            result &&
            typeof result === "object" &&
            "ok" in result &&
            result.ok === false &&
            "error" in result &&
            typeof result.error === "string"
          ) {
            if (result.error.includes("Free tier limit reached")) {
              setShowLimitModal(true);
            }
            throw new Error(result.error);
          }
          const next = await refreshDayPriorities(tripId, dayDate);
          onPrioritiesUpdated(next);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Could not update rides.";
          if (!msg.includes("Free tier limit reached")) {
            // Keep toast noise low when we show the tier modal.
            console.warn(msg);
          }
        } finally {
          setPending(false);
        }
      })();
    },
    [dayDate, onPrioritiesUpdated, tripId],
  );

  const cycleTap = (row: TripRidePriority) => {
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 md:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        role="presentation"
        style={{ touchAction: "none" }}
        className={`absolute inset-0 bg-royal/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-2xl border border-royal bg-[#FAF8F3] shadow-2xl transition-transform duration-300 ease-out safe-area-inset-bottom ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex max-h-[88vh] flex-col">
          <div className="flex justify-center pb-1 pt-3">
            <div className="h-1 w-10 rounded-full bg-royal/20" aria-hidden />
          </div>
          <div className="flex items-start justify-between gap-2 border-b border-gold/20 px-4 py-2">
            <h3 id={titleId} className="font-serif text-lg font-bold text-royal">
              Rides for this day
            </h3>
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-royal/50 active:bg-white"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
            {parkIds.length === 0 ? (
              <p className="font-sans text-sm text-royal/75">
                Assign a park in AM or PM to choose rides.
              </p>
            ) : (
              <>
                <div className="mb-3">
                  <SkipLineLegend />
                </div>
                <div className="mb-3 rounded-lg border border-gold/25 bg-white/80 px-3 py-2">
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-royal">
                    ⚡ Lightning Lane strategy
                  </p>
                  <p className="mt-1 font-sans text-sm leading-relaxed text-royal/85">
                    {strategy}
                  </p>
                </div>

                <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide text-royal">
                  Must-do
                </p>
                <div className="mb-4 space-y-2">
                  {mustRows.map((row, i) => {
                    const a = row.attraction;
                    if (!a) return null;
                    const badge = skipLineBadgeLabel(a.skip_line_tier);
                    const badgeStyle = skipLineBadgeStyle(a.skip_line_tier);
                    const peak = a.avg_wait_peak_minutes;
                    return (
                      <div
                        key={row.id}
                        className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border border-royal/10 bg-white px-3 py-2"
                      >
                        <button
                          type="button"
                          disabled={pending}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-royal/15 text-lg"
                          aria-label="Cycle priority (must-do, if time, remove)"
                          onClick={() => cycleTap(row)}
                        >
                          ★
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="font-sans text-sm font-semibold text-royal">
                            {a.name}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 font-sans text-xs text-royal/70">
                            {badge ? (
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                                style={badgeStyle}
                              >
                                ⚡{badge}
                              </span>
                            ) : null}
                            {peak != null ? (
                              <span className={waitMinutesColourClass(peak)}>
                                {peak} min wait (peak day)
                              </span>
                            ) : null}
                            <span aria-hidden>{thrillEmoji(a.thrill_level)}</span>
                            <span className="capitalize">{a.thrill_level}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            disabled={pending || i === 0}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-royal/15 text-royal disabled:opacity-30"
                            aria-label="Move up"
                            onClick={() => moveWithinSection("must_do", i, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={pending || i >= mustRows.length - 1}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-royal/15 text-royal disabled:opacity-30"
                            aria-label="Move down"
                            onClick={() => moveWithinSection("must_do", i, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {mustRows.length === 0 ? (
                    <p className="font-sans text-sm italic text-royal/50">
                      No must-dos yet.
                    </p>
                  ) : null}
                </div>

                <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide text-royal">
                  If time
                </p>
                <div className="mb-4 space-y-2">
                  {ifRows.map((row, i) => {
                    const a = row.attraction;
                    if (!a) return null;
                    const badge = skipLineBadgeLabel(a.skip_line_tier);
                    const badgeStyle = skipLineBadgeStyle(a.skip_line_tier);
                    const peak = a.avg_wait_peak_minutes;
                    return (
                      <div
                        key={row.id}
                        className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border border-royal/10 bg-white px-3 py-2"
                      >
                        <button
                          type="button"
                          disabled={pending}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-royal/15 text-lg"
                          aria-label="Remove from plan"
                          onClick={() => cycleTap(row)}
                        >
                          ○
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="font-sans text-sm font-semibold text-royal">
                            {a.name}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 font-sans text-xs text-royal/70">
                            {badge ? (
                              <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                                style={badgeStyle}
                              >
                                ⚡{badge}
                              </span>
                            ) : null}
                            {peak != null ? (
                              <span className={waitMinutesColourClass(peak)}>
                                {peak} min wait (peak day)
                              </span>
                            ) : null}
                            <span aria-hidden>{thrillEmoji(a.thrill_level)}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            disabled={pending || i === 0}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-royal/15 text-royal disabled:opacity-30"
                            aria-label="Move up"
                            onClick={() => moveWithinSection("if_time", i, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={pending || i >= ifRows.length - 1}
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-royal/15 text-royal disabled:opacity-30"
                            aria-label="Move down"
                            onClick={() => moveWithinSection("if_time", i, 1)}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {ifRows.length === 0 ? (
                    <p className="font-sans text-sm italic text-royal/50">
                      Nothing in if time.
                    </p>
                  ) : null}
                </div>

                <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-wide text-royal">
                  Available
                </p>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rides…"
                  className="mb-3 min-h-11 w-full rounded-lg border border-royal/20 bg-white px-3 py-2 font-sans text-sm text-royal placeholder:text-royal/40 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40"
                  aria-label="Search available rides"
                />
                <ul className="space-y-2">
                  {availableFiltered.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={pending}
                        className="flex min-h-[48px] w-full items-center justify-between rounded-xl border border-royal/15 bg-white px-4 py-3 text-left font-sans text-sm font-medium text-royal active:bg-cream disabled:opacity-50"
                        onClick={() =>
                          runMutation(() =>
                            toggleRidePriority(tripId, a.id, dayDate, "must_do"),
                          )
                        }
                      >
                        <span>{a.name}</span>
                        <span className="text-gold">+</span>
                      </button>
                    </li>
                  ))}
                </ul>

                {heightLines.length ? (
                  <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 font-sans text-xs text-royal">
                    <p className="font-semibold text-amber-900">Height check</p>
                    <ul className="mt-1 list-inside list-disc">
                      {heightLines.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
      <TierLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        reason="Free includes up to 5 ride priorities per trip. Upgrade for unlimited ride priorities."
        variant="custom"
      />
    </div>
  );
}
