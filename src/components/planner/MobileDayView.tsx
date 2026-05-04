"use client";

import {
  MONTHS_LONG,
  addDays,
  formatDateKey,
  formatDateISO,
  formatUndoSnapshotHint,
  parseDate,
} from "@/lib/date-helpers";
import { getAiDayTimelineForDate } from "@/lib/ai-day-timeline";
import { displayDayForTimelinePanel } from "@/lib/ai-timeline-to-slot-times";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { MobileRidesSheet } from "@/components/planner/MobileRidesSheet";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { heuristicCrowdToneFromNoteText } from "@/lib/planner-crowd-level-meta";
import { parkChromaTileStyle } from "@/lib/theme-colours";
import { isThemePark } from "@/lib/park-categories";
import { dayConditionRow } from "@/lib/planner-day-conditions";
import {
  listThemeParksForAiMustDosFallback,
  readMustDosMap,
} from "@/lib/must-dos";
import {
  normaliseThemeKey,
  themedEmptySlotSurfaceStyle,
  type ThemeKey,
} from "@/lib/themes";
import type { Tier } from "@/lib/tier";
import type {
  AIDayStrategy,
  Assignments,
  Park,
  SlotType,
  TemperatureUnit,
  Trip,
} from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";
import Link from "next/link";
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
import {
  CrowdLevelIndicator,
  crowdLevelFromHeuristicTone,
} from "./CrowdLevelIndicator";
import { MobileBottomBar } from "./MobileBottomBar";
import { MobileParksDrawer } from "./MobileParksDrawer";
import { DayTimelinePanel } from "@/components/planner/DayTimelinePanel";
import { DayParkMustDosSection } from "@/components/planner/DayParkMustDosSection";
import { AIDayStrategyPanel } from "@/components/planner/AIDayStrategyPanel";

const SWIPE_THRESHOLD = 50;

const EMPTY_CATALOGUED_PARK_ID_SET: ReadonlySet<string> = new Set();

const CROWD_DOT: Record<"quiet" | "moderate" | "busy", string> = {
  quiet: "#22C55E",
  moderate: "#EAB308",
  busy: "#EF4444",
};

const SLOTS: { key: SlotType; label: string }[] = [
  { key: "am", label: "AM" },
  { key: "pm", label: "PM" },
  { key: "lunch", label: "LUNCH" },
  { key: "dinner", label: "DINNER" },
];

function stripTime(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function isSameDay(a: Date, b: Date): boolean {
  return stripTime(a) === stripTime(b);
}

function crowdLabel(tone: "low" | "mid" | "high"): string {
  if (tone === "low") return "quiet";
  if (tone === "high") return "busy";
  return "moderate";
}

function mealPrefix(slot: SlotType): string {
  return slot === "lunch" || slot === "dinner" ? "🍽️ " : "";
}

function parkIdsAmPmForDay(assignments: Assignments, dateKey: string): string[] {
  const ass = assignments[dateKey] ?? {};
  const ids = [
    getParkIdFromSlotValue(ass.am),
    getParkIdFromSlotValue(ass.pm),
  ].filter(Boolean) as string[];
  return [...new Set(ids)];
}

function dayOfWeekShort(d: Date): string {
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()] ?? "";
}

function dayOfWeekLong(d: Date): string {
  return [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][d.getDay()] ?? "";
}

function formatDateLong(d: Date): string {
  const day = d.getDate();
  const mon = MONTHS_LONG[d.getMonth()];
  const y = d.getFullYear();
  return `${day} ${mon} ${y}`;
}

export type MobilePlannerDay = {
  dateKey: string;
  date: Date;
  crowdDot: "low" | "mid" | "high" | null;
  crowdLabel: string | null;
  aiNote: string | null;
  userNote: string;
};

export type MobileDayViewProps = {
  trip: Trip;
  /** Merged catalog + custom tiles as parks (same as desktop palette list). */
  parks: Park[];
  assignments: Assignments;
  /** `preferences.ai_day_crowd_notes` keyed by date key. */
  dayNotes: Record<string, string>;
  /** `preferences.day_notes` keyed by date key. */
  userDayNotes: Record<string, string>;
  onAssign: (dateKey: string, slot: SlotType, itemId: string) => void;
  onClear: (dateKey: string, slot: SlotType) => void;
  crowdSummary: string | null;
  readOnly?: boolean;
  onSelectPark?: (parkId: string) => void;
  onMenuExportPdf?: () => void;
  onMenuShare?: () => void;
  onMenuSettings?: () => void;
  /** When set, mobile menu can offer one-tap undo for the last Smart Plan. */
  smartPlanUndoSnapshotAt?: string | null;
  onMenuUndoSmartPlan?: () => void;
  /** Region id for static weather/crowd (defaults to `trip.region_id`). */
  plannerRegionId?: string | null;
  temperatureUnit?: TemperatureUnit;
  /** Persist `preferences.day_notes` for the active day. */
  onSaveUserDayNote?: (dateKey: string, text: string) => void;
  /** Pro+ custom slot times on the day timeline. */
  timelineUnlocked?: boolean;
  onSlotTimeChange?: (
    dateKey: string,
    slot: SlotType,
    timeHHmm: string,
  ) => void;
  /** Ride priorities keyed by ISO date (mobile sheet uses the active day). */
  ridePrioritiesByDay?: Record<string, TripRidePriority[]>;
  rideCountsByDay?: Record<string, { total: number; mustDo: number }>;
  onRideDayPrioritiesUpdated?: (
    dayDate: string,
    items: TripRidePriority[],
  ) => void;
  /**
   * When set (trip planner on `/trip/...`), Rides opens day detail instead of the
   * bottom sheet; inline day notes open the day detail notes section.
   */
  onOpenDayDetail?: (
    dateKey: string,
    options?: { focusNotes?: boolean },
  ) => void;
  /** Opens the consolidated ✨ Plan this day modal (adjust + strategy). */
  onOpenDayPlanner?: (
    dateKey: string,
    options?: { tab?: "adjust" | "strategy"; autoRunStrategy?: boolean },
  ) => void;
  /** Direct entry to AI Day Strategy (upgrade modal on free; generate or mini-wizard on paid). */
  onOpenDayStrategy?: (dateKey: string) => void;
  /** Retail tier for Pro badge on the Day Strategy entry. */
  productTier?: Tier;
  onUndoDayTweak?: (dateKey: string) => void;
  /** Per-park AI must-dos (same server flow as day detail). */
  onGenerateMustDosForPark?: (dateKey: string, parkId: string) => void;
  mustDosGenLoading?: { dateKey: string; parkId: string } | null;
  onToggleMustDoDone?: (
    dateKey: string,
    parkId: string,
    mustDoId: string,
    nextDone: boolean,
  ) => void;
  /** Set of `parks.id` with catalogue data — for catalogue vs AI must-do gating. */
  cataloguedParkIdSet?: ReadonlySet<string>;
  /** `/trip/[id]` when swipe/strip should follow `/day/[date]` URLs (mobile day route). */
  tripRouteBase?: string | null;
  /** Current path day yyyy-mm-dd; pair with tripRouteBase for URL-linked navigation. */
  urlSyncedDayDate?: string | null;
};

function buildTripDays(
  trip: Trip,
  dayNotes: Record<string, string>,
  userDayNotes: Record<string, string>,
): MobilePlannerDay[] {
  const start = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  const out: MobilePlannerDay[] = [];
  for (let d = new Date(start); stripTime(d) <= stripTime(end); d = addDays(d, 1)) {
    const dateKey = formatDateKey(d);
    const rawAi = dayNotes[dateKey];
    const aiSan =
      typeof rawAi === "string" && rawAi.trim()
        ? sanitizeDayNote(rawAi.trim())
        : null;
    const tone = heuristicCrowdToneFromNoteText(aiSan);
    const u = userDayNotes[dateKey];
    const userNote = typeof u === "string" ? u.trim() : "";
    out.push({
      dateKey,
      date: new Date(d),
      crowdDot: tone,
      crowdLabel: tone ? crowdLabel(tone) : null,
      aiNote: aiSan,
      userNote,
    });
  }
  return out;
}

function MobileDayStrip({
  days,
  activeIndex,
  onJumpTo,
  dayLinkHref,
}: {
  days: MobilePlannerDay[];
  activeIndex: number;
  onJumpTo: (i: number) => void;
  /** When set, chips navigate as `<Link>` to day URLs instead of updating local index. */
  dayLinkHref?: (dateKey: string) => string;
}) {
  const chipRefs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const el = chipRefs.current[activeIndex];
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <div className="scrollbar-hide relative overflow-x-auto border-b border-gold/20 bg-white/50">
      <div className="flex min-w-max gap-2 px-4 py-3">
        {days.map((day, i) =>
          dayLinkHref ? (
            <Link
              key={day.dateKey}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              href={dayLinkHref(day.dateKey)}
              scroll={false}
              prefetch={false}
              aria-label={`Day ${i + 1}: ${formatDateLong(day.date)}`}
              aria-current={activeIndex === i ? "date" : undefined}
              className={
                activeIndex === i
                  ? "flex min-w-[56px] flex-col items-center rounded-lg bg-royal px-3 py-2 font-bold text-cream shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                  : "flex min-w-[56px] flex-col items-center rounded-lg border border-gold/30 bg-white px-3 py-2 text-royal transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 active:bg-cream"
              }
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  activeIndex === i ? "text-cream/80" : "text-royal/60"
                }`}
              >
                {dayOfWeekShort(day.date)}
              </span>
              <span className="text-lg font-bold leading-none">{day.date.getDate()}</span>
              {day.crowdDot ? (
                <span className="mt-0.5 inline-flex">
                  <CrowdLevelIndicator
                    level={crowdLevelFromHeuristicTone(day.crowdDot)}
                    size="sm"
                  />
                </span>
              ) : null}
            </Link>
          ) : (
            <button
              key={day.dateKey}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              type="button"
              onClick={() => onJumpTo(i)}
              aria-label={`Day ${i + 1}: ${formatDateLong(day.date)}`}
              aria-pressed={activeIndex === i}
              className={
                activeIndex === i
                  ? "flex min-w-[56px] flex-col items-center rounded-lg bg-royal px-3 py-2 font-bold text-cream shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                  : "flex min-w-[56px] flex-col items-center rounded-lg border border-gold/30 bg-white px-3 py-2 text-royal transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 active:bg-cream"
              }
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${
                  activeIndex === i ? "text-cream/80" : "text-royal/60"
                }`}
              >
                {dayOfWeekShort(day.date)}
              </span>
              <span className="text-lg font-bold leading-none">{day.date.getDate()}</span>
              {day.crowdDot ? (
                <span className="mt-0.5 inline-flex">
                  <CrowdLevelIndicator
                    level={crowdLevelFromHeuristicTone(day.crowdDot)}
                    size="sm"
                  />
                </span>
              ) : null}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function MobileSlotCard({
  slot,
  dateKey,
  assignmentId,
  parkById,
  readOnly,
  onClear,
  onTapAdd,
  colourTheme,
}: {
  slot: SlotType;
  dateKey: string;
  assignmentId: string | undefined;
  parkById: Map<string, Park>;
  readOnly: boolean;
  onClear: (dateKey: string, slot: SlotType) => void;
  onTapAdd: () => void;
  colourTheme: ThemeKey;
}) {
  const meta = SLOTS.find((s) => s.key === slot)!;
  const park = assignmentId ? parkById.get(assignmentId) : undefined;

  const shellStyle = park
    ? parkChromaTileStyle(park.bg_colour, park.fg_colour, colourTheme)
    : themedEmptySlotSurfaceStyle();

  return (
    <div
      className={`flex min-h-[64px] items-center gap-3 rounded-lg px-4 py-3 shadow-sm ${
        park ? "hover:brightness-[1.05]" : "border border-royal/10"
      }`}
      style={shellStyle}
    >
      <div className="min-w-0 flex-1">
        <div
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            park ? "opacity-75" : "text-royal/60"
          }`}
          style={park ? { color: "inherit" } : undefined}
        >
          {meta.label}
        </div>
        {park ? (
          <div style={{ color: "inherit" }}>
            <div className="truncate font-sans text-lg font-medium">
              {mealPrefix(slot)}
              {park.icon ? `${park.icon} ` : ""}
              {park.name}
            </div>
            {(slot === "lunch" || slot === "dinner") &&
            park.affiliate_ticket_url &&
            park.affiliate_ticket_url.trim() !== "" ? (
              <a
                href={park.affiliate_ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block font-sans text-sm font-semibold underline underline-offset-2 opacity-90"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                Book a table →
              </a>
            ) : null}
          </div>
        ) : readOnly ? (
          <p className="font-sans text-sm italic text-royal/45">—</p>
        ) : (
          <button
            type="button"
            onClick={onTapAdd}
            className="font-sans text-sm italic text-royal/50 transition active:text-royal focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Tap to add
          </button>
        )}
      </div>
      {park && !readOnly ? (
        <button
          type="button"
          onClick={() => onClear(dateKey, slot)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl opacity-50 transition hover:opacity-80 active:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          style={{ color: "inherit" }}
          aria-label={`Clear ${meta.label} slot`}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function MobileDayView({
  trip,
  parks,
  assignments,
  dayNotes,
  userDayNotes,
  onAssign,
  onClear,
  crowdSummary: _crowdSummary,
  readOnly = false,
  onSelectPark,
  onMenuExportPdf,
  onMenuShare,
  onMenuSettings,
  smartPlanUndoSnapshotAt = null,
  onMenuUndoSmartPlan,
  plannerRegionId,
  temperatureUnit = "c",
  onSaveUserDayNote,
  timelineUnlocked = false,
  onSlotTimeChange,
  ridePrioritiesByDay = {},
  rideCountsByDay,
  onRideDayPrioritiesUpdated,
  onOpenDayDetail,
  onOpenDayPlanner,
  onOpenDayStrategy,
  productTier = "free",
  onUndoDayTweak,
  onGenerateMustDosForPark,
  mustDosGenLoading = null,
  onToggleMustDoDone,
  cataloguedParkIdSet: cataloguedParkIdSetProp = EMPTY_CATALOGUED_PARK_ID_SET,
  tripRouteBase = null,
  urlSyncedDayDate = null,
}: MobileDayViewProps) {
  void _crowdSummary;
  const router = useRouter();
  const useUrlDayNav = Boolean(tripRouteBase && urlSyncedDayDate);
  const pushTripDay = useCallback(
    (dateKey: string) => {
      if (!tripRouteBase) return;
      const seg = formatDateISO(parseDate(dateKey));
      startTransition(() => {
        router.push(`${tripRouteBase}/day/${seg}`, { scroll: false });
      });
    },
    [router, tripRouteBase],
  );
  const dayLinkHref = useMemo(
    () =>
      tripRouteBase
        ? (dateKey: string) =>
            `${tripRouteBase}/day/${formatDateISO(parseDate(dateKey))}`
        : undefined,
    [tripRouteBase],
  );
  const notesPanelId = useId();
  const mustDosPanelId = useId();
  const regionForConditions = plannerRegionId ?? trip.region_id;
  const [mobileNotesHidden, setMobileNotesHidden] = useState(false);
  const [mobileNoteDraft, setMobileNoteDraft] = useState("");
  const mobileNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const days = useMemo(
    () => buildTripDays(trip, dayNotes, userDayNotes),
    [trip, dayNotes, userDayNotes],
  );

  const [todayIndex, setTodayIndex] = useState(-1);

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (days.length === 0) return;
    const ti = days.findIndex((d) => isSameDay(d.date, new Date()));
    setTodayIndex(ti);
  }, [days]);

  useEffect(() => {
    if (days.length === 0) return;
    setActiveIndex((i) => Math.min(i, days.length - 1));
  }, [days.length]);

  useEffect(() => {
    if (days.length === 0) return;
    if (tripRouteBase && urlSyncedDayDate) return;
    const ti = days.findIndex((d) => isSameDay(d.date, new Date()));
    setActiveIndex(ti >= 0 ? ti : 0);
    setMobileDayLayout("grid");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when switching trips
  }, [trip.id, tripRouteBase, urlSyncedDayDate]);

  useEffect(() => {
    if (!useUrlDayNav || !urlSyncedDayDate || days.length === 0) return;
    const idx = days.findIndex((d) => d.dateKey === urlSyncedDayDate);
    if (idx >= 0) setActiveIndex(idx);
  }, [useUrlDayNav, urlSyncedDayDate, days]);

  const [parksDrawerOpen, setParksDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dayNotesOpen, setDayNotesOpen] = useState(false);
  const [mustDosSheetOpen, setMustDosSheetOpen] = useState(false);
  const [ridesSheetOpen, setRidesSheetOpen] = useState(false);
  const [mobileDayLayout, setMobileDayLayout] = useState<"grid" | "timeline">(
    "grid",
  );
  const [pendingSlot, setPendingSlot] = useState<{
    dateKey: string;
    slot: SlotType;
  } | null>(null);

  const touchStartX = useRef<number | null>(null);
  const lastTouchX = useRef<number | null>(null);

  const parkById = useMemo(
    () => new Map(parks.map((p) => [p.id, p])),
    [parks],
  );

  const colourTheme = normaliseThemeKey(trip.colour_theme);

  const safeIndex = Math.min(
    Math.max(0, activeIndex),
    Math.max(0, days.length - 1),
  );
  const activeDay = days[safeIndex]!;
  const ridePrioritiesForActiveDay =
    ridePrioritiesByDay[activeDay.dateKey] ?? [];
  const rideDisplayCount =
    rideCountsByDay?.[activeDay.dateKey]?.total ??
    ridePrioritiesForActiveDay.length;

  const themeParkIdsAmPm = useMemo(
    () =>
      parkIdsAmPmForDay(assignments, activeDay.dateKey).filter((id) =>
        isThemePark(parkById.get(id)?.park_group),
      ),
    [assignments, activeDay.dateKey, parkById],
  );

  const themeParkIdsForCatalogueSheet = useMemo(
    () =>
      themeParkIdsAmPm.filter((id) => cataloguedParkIdSetProp.has(id)),
    [themeParkIdsAmPm, cataloguedParkIdSetProp],
  );

  const hasAiMustDosForActiveDay = useMemo(
    () =>
      listThemeParksForAiMustDosFallback(
        assignments,
        activeDay.dateKey,
        parkById,
        cataloguedParkIdSetProp,
        readMustDosMap(trip.preferences),
      ).length > 0,
    [
      assignments,
      activeDay.dateKey,
      parkById,
      cataloguedParkIdSetProp,
      trip.preferences,
    ],
  );

  const activeDayStrategy = useMemo((): AIDayStrategy | null => {
    const raw = trip.preferences?.ai_day_strategy;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const s = (raw as Record<string, unknown>)[activeDay.dateKey];
    if (!s || typeof s !== "object" || Array.isArray(s)) return null;
    return s as AIDayStrategy;
  }, [trip.preferences, activeDay.dateKey]);

  const parkNameById = useMemo(
    () => new Map(parks.map((p) => [p.id, p.name] as const)),
    [parks],
  );
  const mobileDayForTimelinePanel = useMemo(() => {
    const raw = assignments[activeDay.dateKey] ?? {};
    const rich = getAiDayTimelineForDate(trip.preferences, activeDay.dateKey);
    return displayDayForTimelinePanel(raw, rich, parkNameById);
  }, [assignments, activeDay.dateKey, trip.preferences, parkNameById]);

  const showRidesSheetButton =
    onOpenDayDetail != null ||
    themeParkIdsAmPm.length === 0 ||
    themeParkIdsForCatalogueSheet.length > 0;

  useEffect(() => {
    setMobileNoteDraft(activeDay.userNote);
  }, [activeDay.dateKey, activeDay.userNote]);

  const flushMobileDayNote = useCallback(
    (dateKey: string, text: string) => {
      if (!onSaveUserDayNote) return;
      onSaveUserDayNote(dateKey, text.slice(0, 500));
    },
    [onSaveUserDayNote],
  );

  const queueMobileDayNote = useCallback(
    (dateKey: string, text: string) => {
      if (!onSaveUserDayNote) return;
      if (mobileNoteTimer.current) clearTimeout(mobileNoteTimer.current);
      mobileNoteTimer.current = setTimeout(() => {
        mobileNoteTimer.current = null;
        flushMobileDayNote(dateKey, text);
      }, 500);
    },
    [flushMobileDayNote, onSaveUserDayNote],
  );

  useEffect(
    () => () => {
      if (mobileNoteTimer.current) clearTimeout(mobileNoteTimer.current);
    },
    [],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0]?.clientX ?? null;
    lastTouchX.current = touchStartX.current;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    lastTouchX.current = e.targetTouches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const start = touchStartX.current;
    const end = lastTouchX.current;
    touchStartX.current = null;
    lastTouchX.current = null;
    if (start == null || end == null) return;
    const distance = start - end;
    if (useUrlDayNav) {
      if (distance > SWIPE_THRESHOLD) {
        const ni = Math.min(days.length - 1, safeIndex + 1);
        const nk = days[ni]?.dateKey;
        if (nk) pushTripDay(nk);
      } else if (distance < -SWIPE_THRESHOLD) {
        const ni = Math.max(0, safeIndex - 1);
        const nk = days[ni]?.dateKey;
        if (nk) pushTripDay(nk);
      }
      return;
    }
    if (distance > SWIPE_THRESHOLD) {
      setActiveIndex((i) => Math.min(days.length - 1, i + 1));
    } else if (distance < -SWIPE_THRESHOLD) {
      setActiveIndex((i) => Math.max(0, i - 1));
    }
  }, [days, pushTripDay, safeIndex, useUrlDayNav]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (ridesSheetOpen) setRidesSheetOpen(false);
        else if (mustDosSheetOpen) setMustDosSheetOpen(false);
        else if (dayNotesOpen) setDayNotesOpen(false);
        else if (menuOpen) setMenuOpen(false);
        else if (parksDrawerOpen) {
          setParksDrawerOpen(false);
          setPendingSlot(null);
        }
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (
        parksDrawerOpen ||
        menuOpen ||
        dayNotesOpen ||
        ridesSheetOpen ||
        mustDosSheetOpen
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (useUrlDayNav) {
          const ni = Math.min(days.length - 1, safeIndex + 1);
          const nk = days[ni]?.dateKey;
          if (nk) pushTripDay(nk);
          return;
        }
        setActiveIndex((i) => Math.min(days.length - 1, i + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (useUrlDayNav) {
          const ni = Math.max(0, safeIndex - 1);
          const nk = days[ni]?.dateKey;
          if (nk) pushTripDay(nk);
          return;
        }
        setActiveIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    days,
    days.length,
    parksDrawerOpen,
    menuOpen,
    dayNotesOpen,
    ridesSheetOpen,
    mustDosSheetOpen,
    useUrlDayNav,
    safeIndex,
    pushTripDay,
  ]);

  const openParksForSlot = useCallback((dateKey: string, slot: SlotType) => {
    if (readOnly) return;
    setPendingSlot({ dateKey, slot });
    setParksDrawerOpen(true);
  }, [readOnly]);

  const openParksFromBar = useCallback(() => {
    setPendingSlot(null);
    setParksDrawerOpen(true);
  }, []);

  const handlePickPark = useCallback(
    (parkId: string) => {
      if (readOnly) return;
      if (pendingSlot) {
        onAssign(pendingSlot.dateKey, pendingSlot.slot, parkId);
        setPendingSlot(null);
      } else {
        onSelectPark?.(parkId);
      }
    },
    [readOnly, pendingSlot, onAssign, onSelectPark],
  );

  const isTodayInRange = todayIndex >= 0;

  if (days.length === 0) {
    return null;
  }

  const hasTips =
    Boolean(activeDay?.aiNote?.trim()) || Boolean(activeDay?.userNote?.trim());
  const activeDaySnapshotCount = (trip.day_snapshots ?? []).filter(
    (snap) => snap.date === activeDay.dateKey,
  ).length;

  return (
    <div className="md:hidden">
      <MobileDayStrip
        days={days}
        activeIndex={safeIndex}
        onJumpTo={setActiveIndex}
        dayLinkHref={useUrlDayNav ? dayLinkHref : undefined}
      />

      <div
        className="px-4 pb-28 pt-2"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={safeIndex}
          className="animate-mobile-card-enter"
        >
          <div className="relative mb-4 border-b border-gold/20 bg-white/50 pb-2">
            <div className="font-sans text-xs font-semibold uppercase tracking-wider text-gold">
              Day {safeIndex + 1} of {days.length}
            </div>
            <h2 className="font-serif text-3xl font-bold uppercase text-royal">
              {dayOfWeekLong(activeDay.date)}
            </h2>
            <div className="font-sans text-sm text-royal/70">
              {formatDateLong(activeDay.date)}
            </div>
            {(() => {
              const dc = dayConditionRow(
                regionForConditions,
                activeDay.date,
                temperatureUnit,
              );
              if (!dc) return null;
              return (
                <div
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-royal/75"
                  title={dc.tooltip}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: CROWD_DOT[dc.crowd] }}
                    aria-hidden
                  />
                  <span className="whitespace-nowrap font-sans text-[11px]">
                    {dc.conditions.weatherEmoji}
                    {dc.tempLabel}
                  </span>
                </div>
              );
            })()}
            {activeDay.crowdDot && activeDay.crowdLabel ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-cream px-3 py-1">
                <CrowdLevelIndicator
                  level={crowdLevelFromHeuristicTone(activeDay.crowdDot)}
                  size="md"
                />
                <span className="font-sans text-xs text-royal/80">
                  Crowds: {activeDay.crowdLabel}
                </span>
              </div>
            ) : null}
            {!readOnly && onOpenDayPlanner ? (
              <button
                type="button"
                disabled={themeParkIdsAmPm.length === 0}
                title={
                  themeParkIdsAmPm.length === 0
                    ? "Assign a theme park day first"
                    : undefined
                }
                className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-royal px-4 py-3 font-sans text-sm font-semibold text-cream shadow-sm transition active:bg-royal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-not-allowed disabled:opacity-55"
                onClick={() => onOpenDayPlanner(activeDay.dateKey)}
              >
                <span aria-hidden>✨</span>
                Plan this day
              </button>
            ) : null}
            {!readOnly && onOpenDayStrategy ? (
              <button
                type="button"
                disabled={themeParkIdsAmPm.length === 0}
                title={
                  themeParkIdsAmPm.length === 0
                    ? "AI Day Strategy is available on park days only"
                    : undefined
                }
                className="mt-2 flex min-h-[48px] w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-royal/25 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition active:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-not-allowed disabled:opacity-55"
                onClick={() => onOpenDayStrategy(activeDay.dateKey)}
              >
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden>✨</span>
                  AI Day Strategy
                  {productTier === "free" ? (
                    <span className="rounded bg-gold/30 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-royal">
                      Pro
                    </span>
                  ) : null}
                </span>
                <span className="font-sans text-[11px] font-normal text-royal/60">
                  Pro feature — sequenced ride plan
                </span>
              </button>
            ) : null}
            {!readOnly && onUndoDayTweak && activeDaySnapshotCount > 0 ? (
              <button
                type="button"
                className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-gold/40 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition active:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                title={`Restores the day to before the last AI tweak — ${activeDaySnapshotCount} changes ago`}
                onClick={() => onUndoDayTweak(activeDay.dateKey)}
              >
                <span aria-hidden>↩</span>
                Undo last AI change
              </button>
            ) : null}
          </div>

          <div className="mb-3 flex gap-1 rounded-lg bg-cream/80 p-0.5">
            <button
              type="button"
              className={`min-h-11 flex-1 rounded-md px-2 font-sans text-xs font-semibold ${
                mobileDayLayout === "grid"
                  ? "bg-white text-royal shadow-sm"
                  : "text-royal/65"
              }`}
              onClick={() => setMobileDayLayout("grid")}
            >
              Grid
            </button>
            <button
              type="button"
              disabled={!timelineUnlocked}
              title={
                !timelineUnlocked
                  ? "Timeline editing is a Pro feature"
                  : undefined
              }
              className={`min-h-11 flex-1 rounded-md px-2 font-sans text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                mobileDayLayout === "timeline"
                  ? "bg-white text-royal shadow-sm"
                  : "text-royal/65"
              }`}
              onClick={() => {
                if (timelineUnlocked) setMobileDayLayout("timeline");
              }}
            >
              <span className="inline-flex items-center justify-center gap-1">
                Timeline
                {!timelineUnlocked ? (
                  <span className="rounded bg-gold/35 px-1 text-[0.55rem] font-bold text-royal">
                    Pro
                  </span>
                ) : null}
              </span>
            </button>
          </div>

          {mobileDayLayout === "grid" ? (
            <div className="space-y-3">
              {SLOTS.map(({ key: slot }) => {
                const ass = assignments[activeDay.dateKey] ?? {};
                const id = getParkIdFromSlotValue(ass[slot]);
                return (
                  <MobileSlotCard
                    key={slot}
                    slot={slot}
                    dateKey={activeDay.dateKey}
                    assignmentId={id}
                    parkById={parkById}
                    readOnly={readOnly}
                    onClear={onClear}
                    onTapAdd={() => openParksForSlot(activeDay.dateKey, slot)}
                    colourTheme={colourTheme}
                  />
                );
              })}
            </div>
          ) : onSlotTimeChange ? (
            <DayTimelinePanel
              day={mobileDayForTimelinePanel}
              parks={parks}
              colourTheme={colourTheme}
              unlocked={timelineUnlocked}
              onTimeChange={(slot, time) =>
                onSlotTimeChange(activeDay.dateKey, slot, time)
              }
            />
          ) : null}

          {activeDayStrategy ? (
            <div className="mt-4">
              <AIDayStrategyPanel strategy={activeDayStrategy} />
            </div>
          ) : null}

          {!readOnly && onRideDayPrioritiesUpdated && showRidesSheetButton ? (
            <button
              type="button"
              onClick={() => {
                if (onOpenDayDetail) {
                  onOpenDayDetail(activeDay.dateKey);
                } else {
                  setRidesSheetOpen(true);
                }
              }}
              className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-royal/15 bg-white py-3 font-sans text-sm font-medium text-royal shadow-sm transition active:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <span aria-hidden>🎢</span>
              Rides
              {rideDisplayCount > 0 ? (
                <span className="rounded-full bg-gold/30 px-2 py-0.5 text-xs font-semibold text-royal">
                  {rideDisplayCount}
                </span>
              ) : null}
            </button>
          ) : null}

          {!readOnly && onSaveUserDayNote && onOpenDayDetail ? (
            <div className="mt-4 rounded-xl border border-royal/10 bg-white/90 p-3">
              <div className="flex min-h-11 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-sans text-xs font-semibold text-royal/70">
                  Day note
                </span>
                <button
                  type="button"
                  className="min-h-11 w-full rounded-lg border border-royal/15 bg-cream px-3 py-2 text-left font-sans text-sm font-medium text-royal transition hover:bg-white sm:w-auto"
                  onClick={() =>
                    onOpenDayDetail(activeDay.dateKey, { focusNotes: true })
                  }
                >
                  {activeDay.userNote ? (
                    <span className="line-clamp-2">{activeDay.userNote}</span>
                  ) : (
                    <span className="italic text-royal/55">Add note…</span>
                  )}
                </button>
              </div>
            </div>
          ) : !readOnly && onSaveUserDayNote ? (
            <div className="mt-4 rounded-xl border border-royal/10 bg-white/90 p-3">
              <div className="flex min-h-11 items-center justify-between gap-2">
                <span className="font-sans text-xs font-semibold text-royal/70">
                  Day notes
                </span>
                <button
                  type="button"
                  className="min-h-11 rounded px-2 font-sans text-xs text-royal/55 underline decoration-royal/25"
                  onClick={() => setMobileNotesHidden((v) => !v)}
                >
                  {mobileNotesHidden ? "Show" : "Hide"}
                </button>
              </div>
              {!mobileNotesHidden ? (
                <>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={mobileNoteDraft}
                    placeholder="Add notes for this day — tips, reminders, bookings…"
                    className="mt-1 w-full min-h-[5.5rem] resize-y rounded-lg border border-royal/20 bg-cream/40 px-3 py-2 font-sans text-sm text-royal placeholder:text-royal/40 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40"
                    onChange={(e) => {
                      const v = e.target.value;
                      setMobileNoteDraft(v);
                      queueMobileDayNote(activeDay.dateKey, v);
                    }}
                    onBlur={() => {
                      if (mobileNoteTimer.current) {
                        clearTimeout(mobileNoteTimer.current);
                        mobileNoteTimer.current = null;
                      }
                      flushMobileDayNote(activeDay.dateKey, mobileNoteDraft);
                    }}
                  />
                  {mobileNoteDraft.length > 400 ? (
                    <p className="mt-1 text-right font-sans text-[10px] text-royal/55">
                      {mobileNoteDraft.length}/500
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : activeDay.userNote ? (
            <p className="mt-4 font-sans text-sm italic leading-relaxed text-royal/60">
              <span aria-hidden>📝 </span>
              {activeDay.userNote}
            </p>
          ) : null}

          {hasTips ? (
            <button
              type="button"
              onClick={() => setDayNotesOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gold/30 bg-cream py-3 font-sans text-sm font-medium text-royal transition active:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <span aria-hidden>💡</span>
              Tips for this day
            </button>
          ) : null}

          {onGenerateMustDosForPark &&
          onToggleMustDoDone &&
          hasAiMustDosForActiveDay &&
          !activeDayStrategy ? (
            <button
              type="button"
              onClick={() => setMustDosSheetOpen(true)}
              className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-royal/15 bg-white py-3 font-sans text-sm font-medium text-royal shadow-sm transition active:bg-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <span aria-hidden>🎯</span>
              Suggested rides (AI)
            </button>
          ) : null}

          <div className="mt-6 flex items-center justify-between px-2">
            {safeIndex > 0 ? (
              <button
                type="button"
                onClick={() => {
                  const ni = safeIndex - 1;
                  if (useUrlDayNav) {
                    const nk = days[ni]?.dateKey;
                    if (nk) pushTripDay(nk);
                  } else {
                    setActiveIndex(ni);
                  }
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-3 font-sans text-sm text-royal/70 transition active:bg-royal/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                ← {dayOfWeekShort(days[safeIndex - 1]!.date)}
              </button>
            ) : (
              <span />
            )}
            {safeIndex < days.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  const ni = safeIndex + 1;
                  if (useUrlDayNav) {
                    const nk = days[ni]?.dateKey;
                    if (nk) pushTripDay(nk);
                  } else {
                    setActiveIndex(ni);
                  }
                }}
                className="flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-3 font-sans text-sm text-royal/70 transition active:bg-royal/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                {dayOfWeekShort(days[safeIndex + 1]!.date)} →
              </button>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>

      {isTodayInRange &&
      safeIndex !== todayIndex &&
      (useUrlDayNav ? Boolean(tripRouteBase) : !onOpenDayDetail) ? (
        <button
          type="button"
          onClick={() => {
            if (useUrlDayNav && tripRouteBase) {
              const nk = days[todayIndex]?.dateKey;
              if (nk) pushTripDay(nk);
              return;
            }
            setActiveIndex(todayIndex);
          }}
          className="fixed bottom-24 right-4 z-30 flex min-h-[48px] min-w-[48px] items-center gap-2 rounded-full bg-gold px-4 py-3 font-sans font-medium text-royal shadow-lg transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 md:hidden"
          aria-label="Jump to today"
        >
          <span aria-hidden>📍</span>
          Today
        </button>
      ) : null}

      <MobileBottomBar
        tripTitle={trip.adventure_name}
        onOpenParks={openParksFromBar}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <MobileParksDrawer
        open={parksDrawerOpen}
        onClose={() => {
          setParksDrawerOpen(false);
          setPendingSlot(null);
        }}
        parks={parks}
        pendingSlot={pendingSlot}
        onPickPark={handlePickPark}
        colourTheme={colourTheme}
      />

      {/* Mobile menu sheet */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${menuOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!menuOpen}
      >
        <div
          role="presentation"
          style={{ touchAction: "none" }}
          className={`absolute inset-0 bg-royal/50 transition-opacity duration-300 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMenuOpen(false)}
        />
        <div
          className={`absolute inset-x-0 bottom-0 rounded-t-2xl border border-gold/20 bg-cream px-4 py-4 shadow-2xl transition-transform duration-300 ease-out safe-area-inset-bottom ${
            menuOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-royal/20" aria-hidden />
          </div>
          <p className="mb-3 font-serif text-lg font-bold text-royal">Menu</p>
          <div className="flex flex-col gap-1 pb-2">
            {onMenuExportPdf ? (
              <button
                type="button"
                className="min-h-[48px] rounded-lg px-4 py-3 text-left font-sans text-sm font-medium text-royal active:bg-white"
                onClick={() => {
                  setMenuOpen(false);
                  onMenuExportPdf();
                }}
              >
                Export PDF
              </button>
            ) : null}
            {!readOnly &&
            smartPlanUndoSnapshotAt &&
            onMenuUndoSmartPlan ? (
              <button
                type="button"
                className="min-h-[48px] rounded-lg px-4 py-3 text-left font-sans text-sm font-medium text-royal/80 active:bg-white"
                title={`Undo Smart Plan from ${formatUndoSnapshotHint(smartPlanUndoSnapshotAt)}`}
                aria-label="Undo last Smart Plan generation"
                onClick={() => {
                  setMenuOpen(false);
                  onMenuUndoSmartPlan();
                }}
              >
                <span aria-hidden>↶ </span>
                Undo Smart Plan
              </button>
            ) : null}
            {onMenuShare ? (
              <button
                type="button"
                className="min-h-[48px] rounded-lg px-4 py-3 text-left font-sans text-sm font-medium text-royal active:bg-white"
                onClick={() => {
                  setMenuOpen(false);
                  onMenuShare();
                }}
              >
                Share
              </button>
            ) : null}
            {onMenuSettings ? (
              <Link
                href="/settings"
                className="min-h-[48px] rounded-lg px-4 py-3 font-sans text-sm font-medium text-royal active:bg-white"
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </Link>
            ) : null}
            <button
              type="button"
              className="mt-2 min-h-[48px] rounded-lg border border-royal/15 px-4 py-3 text-center font-sans text-sm text-royal/70"
              onClick={() => setMenuOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {!readOnly &&
      onRideDayPrioritiesUpdated &&
      !onOpenDayDetail ? (
        <MobileRidesSheet
          open={ridesSheetOpen}
          onClose={() => setRidesSheetOpen(false)}
          tripId={trip.id}
          dayDate={activeDay.dateKey}
          parkIds={themeParkIdsForCatalogueSheet}
          childAges={trip.child_ages ?? []}
          ridePriorities={ridePrioritiesForActiveDay}
          parks={parks}
          onPrioritiesUpdated={(items) => {
            onRideDayPrioritiesUpdated(activeDay.dateKey, items);
          }}
          includeDisneySkipTips={
            trip.planning_preferences?.includeDisneySkipTips !== false
          }
          includeUniversalSkipTips={
            trip.planning_preferences?.includeUniversalSkipTips !== false
          }
        />
      ) : null}

      {/* Day notes bottom sheet */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${dayNotesOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!dayNotesOpen}
      >
        <div
          role="presentation"
          style={{ touchAction: "none" }}
          className={`absolute inset-0 bg-royal/50 transition-opacity duration-300 ${
            dayNotesOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setDayNotesOpen(false)}
        />
        <div
          id={notesPanelId}
          role="dialog"
          aria-modal="true"
          aria-label="Tips for this day"
          className={`absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border border-royal bg-white shadow-2xl transition-transform duration-300 ease-out safe-area-inset-bottom ${
            dayNotesOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="flex justify-center pb-1 pt-3">
            <div className="h-1 w-10 rounded-full bg-royal/20" aria-hidden />
          </div>
          <div className="flex items-start justify-between gap-2 border-b border-gold/20 px-4 py-2">
            <h3 className="font-serif text-lg font-bold text-royal">
              Day {safeIndex + 1} · {formatDateLong(activeDay.date)}
            </h3>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-royal/50 active:bg-cream"
              aria-label="Close"
              onClick={() => setDayNotesOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="space-y-3 px-4 py-4 font-sans text-sm leading-relaxed text-royal/90">
            {activeDay.aiNote ? (
              <p>
                <span className="font-semibold text-royal">Why this day: </span>
                {activeDay.aiNote}
              </p>
            ) : null}
            {activeDay.userNote ? (
              <p>
                <span className="font-semibold text-royal">Your note: </span>
                {activeDay.userNote}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {onGenerateMustDosForPark &&
      onToggleMustDoDone &&
      hasAiMustDosForActiveDay &&
      !activeDayStrategy ? (
        <div
          className={`fixed inset-0 z-[41] md:hidden ${mustDosSheetOpen ? "" : "pointer-events-none"}`}
          aria-hidden={!mustDosSheetOpen}
        >
          <div
            role="presentation"
            style={{ touchAction: "none" }}
            className={`absolute inset-0 bg-royal/50 transition-opacity duration-300 ${
              mustDosSheetOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setMustDosSheetOpen(false)}
          />
          <div
            id={mustDosPanelId}
            role="dialog"
            aria-modal="true"
            aria-label="Suggested AI rides for this day"
            className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-royal bg-cream shadow-2xl transition-transform duration-300 ease-out safe-area-inset-bottom ${
              mustDosSheetOpen ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex justify-center pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-royal/20" aria-hidden />
            </div>
            <div className="flex items-start justify-between gap-2 border-b border-gold/20 px-4 py-2">
              <h3 className="font-serif text-lg font-bold text-royal">
                Suggested rides (AI)
              </h3>
              <button
                type="button"
                className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-xl text-royal/50 active:bg-white"
                aria-label="Close"
                onClick={() => setMustDosSheetOpen(false)}
              >
                ×
              </button>
            </div>
            <p className="px-4 pb-2 font-sans text-xs text-royal/60">
              Suggested order and timing — verify on the day.
            </p>
            <div className="px-2 pb-6 pt-1">
              <DayParkMustDosSection
                hideSectionTitle
                trip={trip}
                dateKey={activeDay.dateKey}
                parks={parks}
                cataloguedParkIdSet={cataloguedParkIdSetProp}
                generatingParkId={
                  mustDosGenLoading?.dateKey === activeDay.dateKey
                    ? mustDosGenLoading.parkId
                    : null
                }
                onGenerateMustDos={(parkId) =>
                  onGenerateMustDosForPark(activeDay.dateKey, parkId)
                }
                onToggleMustDoDone={(parkId, mustDoId, nextDone) =>
                  onToggleMustDoDone(
                    activeDay.dateKey,
                    parkId,
                    mustDoId,
                    nextDone,
                  )
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
