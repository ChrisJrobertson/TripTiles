"use client";

import { ExpandedDayPanel } from "@/components/planner/ExpandedDayPanel";
import { SkipLineLegend } from "@/components/planner/SkipLineLegend";
import { CrowdLevelIndicator } from "@/components/planner/CrowdLevelIndicator";
import { DayConflictBanners } from "@/components/planner/DayConflictBanners";
import {
  ApplyTemplateDialog,
  SaveTemplateDialog,
} from "@/components/planner/DayTemplateDialogs";
import { DuplicateDayModal } from "@/components/planner/DuplicateDayModal";
import { UnsavedChangesModal } from "@/components/app/UnsavedChangesModal";
import { TierLimitModal } from "@/components/paywall/TierLimitModal";
import {
  eachDateKeyInRange,
  formatDateISO,
  parseDate,
} from "@/lib/date-helpers";
import { computePlannerDayConflicts } from "@/lib/planner-day-conflicts";
import { showToast } from "@/lib/toast";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { dayConditionRow } from "@/lib/planner-day-conditions";
import {
  crowdLevelFromHeuristicTone,
  heuristicCrowdToneFromNoteText,
} from "@/lib/planner-crowd-level-meta";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { plannerUserDayNotes } from "@/lib/planner-note-maps";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import type { Tier } from "@/lib/tier";
import type { Park, TemperatureUnit, Trip } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

function prevNextDayKeys(
  trip: Trip,
  dateKey: string,
): { prev: string | null; next: string | null } {
  const keys = eachDateKeyInRange(trip.start_date, trip.end_date);
  const i = keys.indexOf(dateKey);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? keys[i - 1]! : null,
    next: i < keys.length - 1 ? keys[i + 1]! : null,
  };
}

function parkIdsAmPmForDay(trip: Trip, dateKey: string): string[] {
  const ass = trip.assignments[dateKey] ?? {};
  const ids = [
    getParkIdFromSlotValue(ass.am),
    getParkIdFromSlotValue(ass.pm),
  ].filter(Boolean) as string[];
  return [...new Set(ids)];
}

function todayKey(): string {
  return formatDateISO(new Date());
}

function isTodayInTrip(trip: Trip): boolean {
  const k = todayKey();
  const keys = eachDateKeyInRange(trip.start_date, trip.end_date);
  return keys.includes(k);
}

function formatHeaderShort(dateKey: string): string {
  const d = parseDate(`${dateKey}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export type DayDetailLayerProps = {
  trip: Trip;
  dayDate: string;
  tripBasePath: string;
  parks: Park[];
  ridePriorities: TripRidePriority[];
  productTier: Tier;
  plannerRegionId: string | null;
  temperatureUnit: TemperatureUnit;
  onClose: () => void;
  onPrioritiesUpdated: (items: TripRidePriority[]) => void;
  onSaveDayNote: (dateKey: string, text: string) => void;
  onOpenSmartPlan: () => void;
  /** Ride counts for this day when full priorities are not loaded (overview fetch). */
  rideCountsForDay?: { total: number; mustDo: number } | null;
};

export function DayDetailLayer({
  trip,
  dayDate,
  tripBasePath,
  parks,
  ridePriorities,
  productTier,
  plannerRegionId,
  temperatureUnit,
  onClose,
  onPrioritiesUpdated,
  onSaveDayNote,
  onOpenSmartPlan,
  rideCountsForDay = null,
}: DayDetailLayerProps) {
  const router = useRouter();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{
    x: number;
    y: number;
    t: number;
    pointerId: number;
  } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [applyTplOpen, setApplyTplOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [tierLimitOpen, setTierLimitOpen] = useState(false);
  const moreWrapRef = useRef<HTMLDivElement>(null);
  const [deskKb, setDeskKb] = useState(false);
  const [noteDraft, setNoteDraft] = useState(() => {
    const m = plannerUserDayNotes(trip);
    return m[dayDate] ?? "";
  });
  const [noteDirty, setNoteDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  useUnsavedChanges(noteDirty);

  useEffect(() => {
    const m = plannerUserDayNotes(trip);
    setNoteDraft(m[dayDate] ?? "");
    setNoteDirty(false);
  }, [trip, dayDate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#day-notes") {
      const el = document.getElementById("day-notes");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [dayDate]);

  const { prev, next } = useMemo(
    () => prevNextDayKeys(trip, dayDate),
    [trip, dayDate],
  );

  const navigateToRaw = useCallback(
    (dk: string | null) => {
      if (!dk) return;
      const seg = formatDateISO(parseDate(dk));
      router.push(`${tripBasePath}/day/${seg}`, { scroll: false });
    },
    [router, tripBasePath],
  );

  const queueAction = useCallback(
    (action: () => void) => {
      if (noteDirty) {
        setPendingAction(() => action);
        return;
      }
      action();
    },
    [noteDirty],
  );

  const saveNoteDraft = useCallback(() => {
    if (!noteDirty) return;
    onSaveDayNote(dayDate, noteDraft.slice(0, 500));
    setNoteDirty(false);
  }, [dayDate, noteDraft, noteDirty, onSaveDayNote]);

  const runPendingAction = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    action?.();
  }, [pendingAction]);

  const confirmSaveAndContinue = useCallback(() => {
    saveNoteDraft();
    runPendingAction();
  }, [runPendingAction, saveNoteDraft]);

  const confirmDiscardAndContinue = useCallback(() => {
    const m = plannerUserDayNotes(trip);
    setNoteDraft(m[dayDate] ?? "");
    setNoteDirty(false);
    runPendingAction();
  }, [trip, dayDate, runPendingAction]);

  const closeLayer = useCallback(() => {
    queueAction(() => {
      setMoreOpen(false);
      onClose();
    });
  }, [onClose, queueAction]);

  const navigateTo = useCallback(
    (dk: string | null) => {
      if (!dk) return;
      queueAction(() => navigateToRaw(dk));
    },
    [navigateToRaw, queueAction],
  );

  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);

  const dayConflicts = useMemo(
    () =>
      computePlannerDayConflicts(
        trip,
        dayDate,
        ridePriorities,
        rideCountsForDay ?? undefined,
        parkById,
      ),
    [trip, dayDate, ridePriorities, rideCountsForDay, parkById],
  );

  const ass = trip.assignments[dayDate] ?? {};
  const meals = (["lunch", "dinner"] as const).map((slot) => {
    const id = getParkIdFromSlotValue(ass[slot]);
    const park = id ? parkById.get(id) : undefined;
    return { slot, park };
  });

  const regionForConditions = plannerRegionId ?? trip.region_id;
  const dc = dayConditionRow(
    regionForConditions,
    parseDate(`${dayDate}T12:00:00`),
    temperatureUnit,
  );

  const rawAi = trip.preferences?.ai_day_crowd_notes;
  const aiNoteForDay =
    rawAi &&
    typeof rawAi === "object" &&
    !Array.isArray(rawAi) &&
    typeof (rawAi as Record<string, string>)[dayDate] === "string"
      ? sanitizeDayNote(
          String((rawAi as Record<string, string>)[dayDate]).trim(),
        )
      : null;
  const tone = aiNoteForDay
    ? heuristicCrowdToneFromNoteText(aiNoteForDay)
    : null;
  const crowdLevel = tone ? crowdLevelFromHeuristicTone(tone) : null;

  const smartPlanPreviewLine =
    aiNoteForDay && aiNoteForDay.length > 0
      ? aiNoteForDay.split(/\n+/)[0]!.slice(0, 220)
      : null;

  const todayK = todayKey();
  const showJumpToday =
    isTodayInTrip(trip) && dayDate !== todayK && eachDateKeyInRange(trip.start_date, trip.end_date).includes(todayK);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setDeskKb(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (ev: MouseEvent) => {
      if (
        moreWrapRef.current &&
        !moreWrapRef.current.contains(ev.target as Node)
      ) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    focusables[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMoreOpen(false);
        onClose();
        return;
      }
      if (!deskKb) return;
      const ae = document.activeElement;
      if (
        ae instanceof HTMLInputElement ||
        ae instanceof HTMLTextAreaElement ||
        ae instanceof HTMLSelectElement
      ) {
        return;
      }
      if (ae instanceof HTMLElement && ae.isContentEditable) {
        return;
      }
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        navigateTo(prev);
      }
      if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        navigateTo(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deskKb, onClose, prev, next, navigateTo]);

  const onSwipePointerDown = (e: React.PointerEvent) => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        'input,textarea,button,[contenteditable="true"],[contenteditable],[data-no-swipe]',
      )
    ) {
      return;
    }
    swipeRef.current = {
      x: e.clientX,
      y: e.clientY,
      t: Date.now(),
      pointerId: e.pointerId,
    };
  };

  const onSwipePointerUp = (e: React.PointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start || start.pointerId !== e.pointerId) return;
    if (typeof window !== "undefined" && window.innerWidth >= 768) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = Date.now() - start.t;
    if (dt > 500) return;
    if (Math.abs(dx) <= 60) return;
    if (Math.abs(dy) >= 40) return;
    if (dx > 60 && prev) navigateTo(prev);
    else if (dx < -60 && next) navigateTo(next);
  };

  const parkLabels = useMemo(() => {
    const ids = parkIdsAmPmForDay(trip, dayDate);
    const names = ids
      .map((id) => parkById.get(id)?.name)
      .filter(Boolean) as string[];
    if (names.length === 0) return "Rest / pool";
    if (names.length === 1) return names[0]!;
    return names.join(" · ");
  }, [trip, dayDate, parkById]);

  const handlePlanMyDay = () => {
    onOpenSmartPlan();
  };

  const openProUpsell = () => {
    setTierLimitOpen(true);
  };

  const refreshTrip = () => {
    startTransition(() => router.refresh());
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[95] hidden bg-black/40 md:block"
        aria-label="Close day detail"
        onClick={closeLayer}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-[100] flex flex-col bg-cream shadow-2xl transition-transform duration-200 ease-out md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:max-w-[100vw] md:border-l md:border-royal/15"
      >
        <header className="flex shrink-0 flex-col gap-2 border-b border-royal/10 bg-cream px-3 py-3 safe-area-inset-top">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-royal/15 bg-white text-lg text-royal shadow-sm transition hover:bg-cream"
                aria-label="Back to trip overview"
                onClick={closeLayer}
              >
                ←
              </button>
              <div className="min-w-0">
                <h1
                  id={titleId}
                  className="font-serif text-lg font-semibold leading-tight text-royal"
                >
                  {formatHeaderShort(dayDate)}
                </h1>
                <p className="mt-0.5 font-sans text-xs text-royal/70">
                  {parkLabels}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {prev ? (
                <button
                  type="button"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-royal/15 bg-white text-sm text-royal"
                  aria-label="Previous day"
                  onClick={() => navigateTo(prev)}
                >
                  ←
                </button>
              ) : null}
              {next ? (
                <button
                  type="button"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-royal/15 bg-white text-sm text-royal"
                  aria-label="Next day"
                  onClick={() => navigateTo(next)}
                >
                  →
                </button>
              ) : null}
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-lg border border-royal/15 bg-white px-2 font-sans text-[11px] font-semibold text-royal"
                onClick={() => queueAction(() => setDupOpen(true))}
              >
                Duplicate
              </button>
              <div className="relative shrink-0" ref={moreWrapRef}>
                <button
                  type="button"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-royal/15 bg-white text-lg leading-none text-royal"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  aria-label="More day actions"
                  onClick={() => setMoreOpen((o) => !o)}
                >
                  ⋮
                </button>
                {moreOpen ? (
                  <div
                    role="menu"
                    aria-label="Day actions"
                    className="absolute right-0 z-50 mt-1 min-w-[13.5rem] rounded-xl border border-royal/15 bg-white py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full min-h-11 flex-col items-start gap-0.5 px-3 py-2 text-left font-sans text-sm text-royal hover:bg-cream"
                      onClick={() => {
                        setMoreOpen(false);
                        if (productTier === "free") {
                          openProUpsell();
                          return;
                        }
                        setSaveTplOpen(true);
                      }}
                    >
                      <span>Save as template…</span>
                      {productTier === "free" ? (
                        <span className="font-sans text-[0.65rem] text-royal/55">
                          🔒 Pro feature
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full min-h-11 flex-col items-start gap-0.5 px-3 py-2 text-left font-sans text-sm text-royal hover:bg-cream"
                      onClick={() => {
                        setMoreOpen(false);
                        if (productTier === "free") {
                          openProUpsell();
                          return;
                        }
                        setApplyTplOpen(true);
                      }}
                    >
                      <span>Apply template…</span>
                      {productTier === "free" ? (
                        <span className="font-sans text-[0.65rem] text-royal/55">
                          🔒 Pro feature
                        </span>
                      ) : null}
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="hidden min-h-11 min-w-11 items-center justify-center rounded-lg border border-royal/15 bg-white text-sm text-royal md:flex"
                aria-label="Close"
                onClick={closeLayer}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-sans text-xs text-royal/80">
            {dc ? (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden>{dc.conditions.weatherEmoji}</span>
                <span>{dc.tempLabel}</span>
              </span>
            ) : null}
            {crowdLevel ? (
              <span className="inline-flex items-center gap-1">
                <CrowdLevelIndicator level={crowdLevel} size="sm" />
                <span>Crowd</span>
              </span>
            ) : null}
            {showJumpToday ? (
              <button
                type="button"
                className="ml-auto rounded-full border border-gold/40 bg-gold/20 px-3 py-1.5 font-sans text-xs font-semibold text-royal"
                onClick={() => queueAction(() => navigateToRaw(todayK))}
              >
                Jump to today
              </button>
            ) : null}
          </div>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-3 py-4 pb-28 md:pb-20"
          onPointerDown={onSwipePointerDown}
          onPointerUp={onSwipePointerUp}
          onPointerCancel={onSwipePointerUp}
        >
          <DayConflictBanners
            tripId={trip.id}
            dayDate={dayDate}
            conflicts={dayConflicts}
            onOpenSmartPlan={onOpenSmartPlan}
          />
          <section className="mb-4 rounded-lg border border-royal/10 bg-white/90 p-3">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-royal/60">
              Smart Plan
            </p>
            {smartPlanPreviewLine ? (
              <p className="mt-1 font-sans text-sm leading-relaxed text-royal/85">
                {smartPlanPreviewLine}
              </p>
            ) : (
              <p className="mt-1 font-sans text-sm italic text-royal/55">
                No crowd tip for this day yet — run Smart Plan for the trip.
              </p>
            )}
            <button
              type="button"
              className="mt-3 min-h-11 w-full rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream shadow-sm transition hover:bg-royal/90"
              onClick={handlePlanMyDay}
            >
              Plan my day ✨
            </button>
          </section>

          <div className="mb-3">
            <SkipLineLegend />
          </div>

          <ExpandedDayPanel
            embedded
            tripId={trip.id}
            dayDate={dayDate}
            parkIds={parkIdsAmPmForDay(trip, dayDate)}
            childAges={trip.child_ages ?? []}
            ridePriorities={ridePriorities}
            parks={parks}
            onClose={closeLayer}
            onPrioritiesUpdated={onPrioritiesUpdated}
          />

          <section className="mt-6 border-t border-royal/10 pt-4">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/70">
              Dining
            </h2>
            <ul className="mt-2 space-y-2 font-sans text-sm text-royal">
              {meals.every((m) => !m.park) ? (
                <li className="italic text-royal/55">No meal tiles for this day.</li>
              ) : (
                meals.flatMap(({ slot, park }) =>
                  park
                    ? [
                        <li key={slot}>
                          <span className="font-semibold capitalize">{slot}:</span>{" "}
                          {park.icon ? `${park.icon} ` : ""}
                          {park.name}
                        </li>,
                      ]
                    : [],
                )
              )}
            </ul>
          </section>

          <section id="day-notes" className="mt-6 border-t border-royal/10 pt-4">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-royal/70">
              Day note
            </h2>
            <textarea
              className="mt-2 min-h-[6rem] w-full resize-y rounded-lg border border-royal/20 bg-white px-3 py-2 font-sans text-sm text-royal focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40"
              maxLength={500}
              value={noteDraft}
              onChange={(e) => {
                setNoteDraft(e.target.value);
                setNoteDirty(true);
              }}
              onBlur={() => {
                if (!noteDirty) return;
                saveNoteDraft();
              }}
              placeholder="Notes for this day — reminders, bookings, must-dos…"
              aria-label="Day note"
            />
          </section>

          <div className="mt-10 flex items-center justify-between gap-3 pb-6 md:hidden">
            {prev ? (
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl border border-royal/20 bg-white py-3 font-sans text-sm font-semibold text-royal shadow-sm"
                onClick={() => navigateTo(prev)}
              >
                ← Previous day
              </button>
            ) : (
              <span className="flex-1" />
            )}
            {next ? (
              <button
                type="button"
                className="min-h-12 flex-1 rounded-xl border border-royal/20 bg-white py-3 font-sans text-sm font-semibold text-royal shadow-sm"
                onClick={() => navigateTo(next)}
              >
                Next day →
              </button>
            ) : (
              <span className="flex-1" />
            )}
          </div>
        </div>
      </div>

      <TierLimitModal
        isOpen={tierLimitOpen}
        onClose={() => setTierLimitOpen(false)}
        reason="That option is part of Pro and Family — upgrade to unlock day templates and recurring duplicates."
        variant="custom"
      />

      <SaveTemplateDialog
        open={saveTplOpen}
        onClose={() => setSaveTplOpen(false)}
        trip={trip}
        dayDate={dayDate}
        ridePriorities={ridePriorities}
        productTier={productTier}
        onLocked={() => {
          setSaveTplOpen(false);
          openProUpsell();
        }}
        onSaved={() => {
          showToast("Template saved", {
            type: "success",
            debounceKey: "day-template-saved",
            debounceMs: 500,
          });
          refreshTrip();
        }}
      />

      <ApplyTemplateDialog
        open={applyTplOpen}
        onClose={() => setApplyTplOpen(false)}
        tripId={trip.id}
        dayDate={dayDate}
        productTier={productTier}
        onLocked={() => {
          setApplyTplOpen(false);
          openProUpsell();
        }}
        onApplied={() => {
          showToast("Template applied", {
            type: "success",
            debounceKey: "day-template-applied",
            debounceMs: 500,
          });
          refreshTrip();
        }}
      />

      <DuplicateDayModal
        open={dupOpen}
        onClose={() => setDupOpen(false)}
        trip={trip}
        tripId={trip.id}
        sourceDate={dayDate}
        productTier={productTier}
        onLockedPaidTemplates={() => {
          setDupOpen(false);
          openProUpsell();
        }}
        onSuccess={() => {
          showToast("Day duplicated", {
            type: "success",
            debounceKey: "day-duplicated",
            debounceMs: 500,
          });
          refreshTrip();
        }}
      />
      <UnsavedChangesModal
        isOpen={pendingAction != null}
        onCancel={() => setPendingAction(null)}
        onSaveAndContinue={confirmSaveAndContinue}
        onDiscardChanges={confirmDiscardAndContinue}
      />
    </>
  );
}
