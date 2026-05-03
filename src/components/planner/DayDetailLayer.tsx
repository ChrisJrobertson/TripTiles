"use client";

import { ExpandedDayPanel } from "@/components/planner/ExpandedDayPanel";
import { SkipLineLegend } from "@/components/planner/SkipLineLegend";
import { CrowdLevelIndicator } from "@/components/planner/CrowdLevelIndicator";
import { DayConflictBanners } from "@/components/planner/DayConflictBanners";
import { DayHeatSidecar } from "@/components/planner/DayHeatSidecar";
import { DayMustDoChecklist } from "@/components/planner/DayMustDoChecklist";
import { DayTimeline } from "@/components/planner/DayTimeline";
import { DayParkMustDosSection } from "@/components/planner/DayParkMustDosSection";
import {
  ApplyTemplateDialog,
  SaveTemplateDialog,
} from "@/components/planner/DayTemplateDialogs";
import { DuplicateDayModal } from "@/components/planner/DuplicateDayModal";
import { UnsavedChangesModal } from "@/components/app/UnsavedChangesModal";
import { TierLimitModal } from "@/components/paywall/TierLimitModal";
import { updateTripPlanningPreferencesAction } from "@/actions/trips";
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
  type CrowdLevel,
} from "@/lib/planner-crowd-level-meta";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { truncateForPreview } from "@/lib/truncate-text";
import { plannerUserDayNotes } from "@/lib/planner-note-maps";
import { getAiDayTimelineForDate } from "@/lib/ai-day-timeline";
import { buildSkipLineDayTimelineRows } from "@/lib/skip-line-day-timeline";
import { isThemePark } from "@/lib/park-categories";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import type { Tier } from "@/lib/tier";
import type {
  Assignment,
  Park,
  TemperatureUnit,
  Trip,
  TripPlanningPreferences,
} from "@/lib/types";
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
  onOpenDayTweak: (dateKey: string) => void;
  onUndoDayTweak: (dateKey: string) => void;
  onGenerateMustDosForPark: (parkId: string) => void;
  generatingMustDosParkId: string | null;
  onToggleMustDoDone: (
    parkId: string,
    mustDoId: string,
    nextDone: boolean,
  ) => void;
  /** Ride counts for this day when full priorities are not loaded (overview fetch). */
  rideCountsForDay?: { total: number; mustDo: number } | null;
  /** Update trip in parent after planning_preferences change (e.g. skip-line toggles). */
  onTripPatch?: (patch: Partial<Trip>) => void;
  /** Parks with a catalogue: never show AI and catalogue for the same `park_id`. */
  cataloguedParkIdSet: ReadonlySet<string>;
  /** All days’ ride rows for this trip (duplicate / template replace guards). */
  ridePrioritiesByDayForTrip: Record<string, TripRidePriority[]>;
};

export function DayDetailLayer({
  trip,
  dayDate,
  tripBasePath,
  parks,
  cataloguedParkIdSet,
  ridePriorities,
  productTier,
  plannerRegionId,
  temperatureUnit,
  onClose,
  onPrioritiesUpdated,
  onSaveDayNote,
  onOpenSmartPlan,
  onOpenDayTweak,
  onUndoDayTweak,
  onGenerateMustDosForPark,
  generatingMustDosParkId,
  onToggleMustDoDone,
  rideCountsForDay = null,
  onTripPatch,
  ridePrioritiesByDayForTrip,
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

  const amPmThemeIdsForRides = useMemo(() => {
    const ids = parkIdsAmPmForDay(trip, dayDate);
    return ids.filter((id) => isThemePark(parkById.get(id)?.park_group));
  }, [trip, dayDate, parkById]);

  const expandedPanelParkIds = useMemo(
    () => amPmThemeIdsForRides.filter((id) => cataloguedParkIdSet.has(id)),
    [amPmThemeIdsForRides, cataloguedParkIdSet],
  );

  const showExpandedDayPanel = useMemo(
    () =>
      amPmThemeIdsForRides.length === 0 || expandedPanelParkIds.length > 0,
    [amPmThemeIdsForRides.length, expandedPanelParkIds.length],
  );

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

  const ass = useMemo(
    () => trip.assignments[dayDate] ?? {},
    [trip.assignments, dayDate],
  );
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

  const parksById = useMemo(
    () => Object.fromEntries(parks.map((p) => [p.id, p])) as Record<
      string,
      (typeof parks)[0]
    >,
    [parks],
  );

  const hasDayAssignments = useMemo(() => {
    const a = trip.assignments[dayDate] ?? {};
    return (
      Boolean(getParkIdFromSlotValue(a.am)) ||
      Boolean(getParkIdFromSlotValue(a.pm)) ||
      Boolean(getParkIdFromSlotValue(a.lunch)) ||
      Boolean(getParkIdFromSlotValue(a.dinner))
    );
  }, [trip.assignments, dayDate]);

  const richTimeline = useMemo(
    () => getAiDayTimelineForDate(trip.preferences, dayDate),
    [trip.preferences, dayDate],
  );
  const showDayPlannerBlock = hasDayAssignments || Boolean(richTimeline);

  const parkOpenForTimeline = richTimeline?.park_hours.open ?? "09:00";
  const skipLineReturnRows = useMemo(
    () =>
      buildSkipLineDayTimelineRows(ass, ridePriorities, parkOpenForTimeline),
    [ass, ridePriorities, parkOpenForTimeline],
  );

  const smartPlanReturnEcho = useMemo(() => {
    const raw = (trip.preferences as { ai_skip_line_return_echo?: unknown } | null)
      ?.ai_skip_line_return_echo;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const day = (raw as Record<string, unknown>)[dayDate];
    if (!Array.isArray(day) || day.length === 0) return null;
    const out: { attraction_id: string; hhmm: string }[] = [];
    for (const r of day) {
      if (!r || typeof r !== "object" || Array.isArray(r)) continue;
      const o = r as Record<string, unknown>;
      if (typeof o.attraction_id === "string" && typeof o.hhmm === "string")
        out.push({ attraction_id: o.attraction_id, hhmm: o.hhmm });
    }
    return out.length > 0 ? out : null;
  }, [trip.preferences, dayDate]);

  const heatTempC = dc ? Math.round(dc.conditions.tempHighC) : 22;
  const heatCrowd: CrowdLevel = crowdLevel ?? dc?.crowd ?? "moderate";

  const smartPlanPreviewLine =
    aiNoteForDay && aiNoteForDay.length > 0
      ? truncateForPreview(
          sanitizeDayNote(aiNoteForDay.split(/\n+/)[0]!.trim()),
          220,
        )
      : null;

  const todayK = todayKey();
  const showJumpToday =
    isTodayInTrip(trip) && dayDate !== todayK && eachDateKeyInRange(trip.start_date, trip.end_date).includes(todayK);
  const daySnapshotCount = (trip.day_snapshots ?? []).filter(
    (snap) => snap.date === dayDate,
  ).length;
  const latestDaySnapshot = [...(trip.day_snapshots ?? [])]
    .filter((snap) => snap.date === dayDate)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

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

  const [prefsSaving, setPrefsSaving] = useState(false);

  const persistSkipLinePrefs = useCallback(
    async (nextDisney: boolean, nextUniversal: boolean) => {
      setPrefsSaving(true);
      try {
        const base = trip.planning_preferences;
        const next: TripPlanningPreferences = base
          ? {
              ...base,
              includeDisneySkipTips: nextDisney,
              includeUniversalSkipTips: nextUniversal,
            }
          : {
              pace: "balanced",
              mustDoParks: [],
              priorities: [],
              additionalNotes: null,
              adults: trip.adults,
              children: trip.children,
              childAges: trip.child_ages ?? [],
              includeDisneySkipTips: nextDisney,
              includeUniversalSkipTips: nextUniversal,
            };
        const res = await updateTripPlanningPreferencesAction({
          tripId: trip.id,
          planningPreferences: next,
        });
        if (!res.ok) {
          showToast(res.error);
          return;
        }
        onTripPatch?.({ planning_preferences: next });
        if (!onTripPatch) {
          startTransition(() => router.refresh());
        }
      } finally {
        setPrefsSaving(false);
      }
    },
    [trip, onTripPatch, router],
  );

  const openProUpsell = () => {
    setTierLimitOpen(true);
  };

  const refreshTrip = () => {
    startTransition(() => router.refresh());
  };

  const renderSmartPlanBody = () => (
    <>
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
      <div className="mt-3 rounded-lg border border-gold/30 bg-white px-3 py-2.5">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-royal/60">
          Skip-the-line passes
        </p>
        <p className="mt-1 font-sans text-xs leading-relaxed text-royal/65">
          Choose before you generate — Smart Plan uses these for this trip.
        </p>
        <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-md border border-royal/10 bg-cream/40 px-2 py-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
            checked={trip.planning_preferences?.includeDisneySkipTips !== false}
            disabled={prefsSaving}
            onChange={(e) =>
              void persistSkipLinePrefs(
                e.target.checked,
                trip.planning_preferences?.includeUniversalSkipTips !== false,
              )
            }
          />
          <span className="min-w-0 font-sans text-xs leading-snug text-royal/85">
            <span className="font-semibold text-royal">
              Disney Lightning Lane / Genie+ tips
            </span>
          </span>
        </label>
        <label className="mt-1.5 flex cursor-pointer items-start gap-2.5 rounded-md border border-royal/10 bg-cream/40 px-2 py-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-royal/35 accent-royal"
            checked={trip.planning_preferences?.includeUniversalSkipTips !== false}
            disabled={prefsSaving}
            onChange={(e) =>
              void persistSkipLinePrefs(
                trip.planning_preferences?.includeDisneySkipTips !== false,
                e.target.checked,
              )
            }
          />
          <span className="min-w-0 font-sans text-xs leading-snug text-royal/85">
            <span className="font-semibold text-royal">
              Universal Express-style tips
            </span>
          </span>
        </label>
      </div>
      <button
        type="button"
        className="mt-3 min-h-11 w-full rounded-lg bg-royal px-4 py-2.5 font-sans text-sm font-semibold text-cream shadow-sm transition hover:bg-royal/90"
        onClick={handlePlanMyDay}
      >
        Plan my day ✨
      </button>
    </>
  );

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
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-royal px-3 py-2 font-sans text-xs font-semibold text-cream shadow-sm transition hover:bg-royal/90"
              onClick={() => queueAction(() => onOpenDayTweak(dayDate))}
            >
              <span aria-hidden>✨</span>
              AI tweak this day
            </button>
            {daySnapshotCount > 0 && latestDaySnapshot ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-gold/40 bg-white px-3 py-2 font-sans text-xs font-semibold text-royal shadow-sm transition hover:bg-cream"
                title={`Restores the day to before the last AI tweak — ${daySnapshotCount} changes ago`}
                onClick={() => queueAction(() => onUndoDayTweak(dayDate))}
              >
                <span aria-hidden>↩</span>
                Undo last AI change
              </button>
            ) : null}
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
            onGenerateMustDosForPark={onGenerateMustDosForPark}
            generatingMustDosParkId={generatingMustDosParkId}
          />
          {showDayPlannerBlock ? (
            <>
              <DayTimeline
                date={dayDate}
                assignments={ass}
                parks={parksById}
                dayNotes={
                  richTimeline ? undefined : (aiNoteForDay ?? undefined)
                }
                richTimeline={richTimeline}
                skipLineReturnRows={
                  skipLineReturnRows.length > 0 ? skipLineReturnRows : null
                }
              />
              {smartPlanReturnEcho && smartPlanReturnEcho.length > 0 ? (
                <p className="mb-2 mt-2 font-sans text-xs leading-relaxed text-royal/60 dark:text-neutral-300/90">
                  Last Smart Plan structured echo:{" "}
                  {smartPlanReturnEcho
                    .map((e) => `${e.attraction_id} @ ${e.hhmm}`)
                    .join(" · ")}
                </p>
              ) : null}
              <div className="mt-3">
                <DayHeatSidecar
                  tempC={heatTempC}
                  crowdLevel={heatCrowd}
                  heatPlanOverride={richTimeline?.heat_plan}
                />
              </div>
              {richTimeline?.transport ? (
                <div className="mt-3">
                  <aside
                    className="rounded-lg border-[0.5px] border-royal/15 bg-white/95 p-3.5 shadow-sm dark:border-white/10 dark:bg-neutral-900/30"
                    aria-label="Transport"
                  >
                    <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.5px] text-royal/60 dark:text-neutral-200/80">
                      Transport
                    </p>
                    <p className="mt-1.5 font-sans text-sm leading-snug text-royal/85 dark:text-neutral-200">
                      {richTimeline.transport}
                    </p>
                  </aside>
                </div>
              ) : null}
              {richTimeline && richTimeline.must_do.length > 0 ? (
                <div className="mt-3">
                  <DayMustDoChecklist
                    tripId={trip.id}
                    dateKey={dayDate}
                    items={richTimeline.must_do}
                  />
                </div>
              ) : null}
            </>
          ) : null}
          {showDayPlannerBlock ? (
            <details className="mb-4 mt-3 rounded-lg border border-royal/10 bg-white/90 open:border-royal/20 dark:border-white/10 dark:bg-neutral-900/20">
              <summary className="cursor-pointer list-none p-3 font-sans text-sm font-semibold text-royal marker:hidden [&::-webkit-details-marker]:hidden dark:text-neutral-200">
                Regenerate with different options
              </summary>
              <div className="border-t border-royal/10 px-3 pb-3 pt-0 dark:border-white/10">
                {renderSmartPlanBody()}
              </div>
            </details>
          ) : (
            <section className="mb-4 mt-0 rounded-lg border border-royal/10 bg-white/90 p-3 dark:border-white/10 dark:bg-neutral-900/20">
              {renderSmartPlanBody()}
            </section>
          )}

          <div className="mb-3">
            <SkipLineLegend />
          </div>

          {showExpandedDayPanel ? (
            <ExpandedDayPanel
              embedded
              tripId={trip.id}
              dayDate={dayDate}
              dayAssignment={ass as Partial<Assignment>}
              plannerPreferences={
                trip.preferences as Record<string, unknown> | null | undefined
              }
              parkIds={
                amPmThemeIdsForRides.length === 0
                  ? []
                  : expandedPanelParkIds
              }
              childAges={trip.child_ages ?? []}
              ridePriorities={ridePriorities}
              parks={parks}
              onClose={closeLayer}
              onPrioritiesUpdated={onPrioritiesUpdated}
              includeDisneySkipTips={
                trip.planning_preferences?.includeDisneySkipTips !== false
              }
              includeUniversalSkipTips={
                trip.planning_preferences?.includeUniversalSkipTips !== false
              }
            />
          ) : null}

          <DayParkMustDosSection
            trip={trip}
            dateKey={dayDate}
            parks={parks}
            cataloguedParkIdSet={cataloguedParkIdSet}
            generatingParkId={generatingMustDosParkId}
            onGenerateMustDos={onGenerateMustDosForPark}
            onToggleMustDoDone={onToggleMustDoDone}
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
        rideRowsForTargetDay={ridePriorities}
        parks={parks}
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
        ridePrioritiesByDay={ridePrioritiesByDayForTrip}
        parks={parks}
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
