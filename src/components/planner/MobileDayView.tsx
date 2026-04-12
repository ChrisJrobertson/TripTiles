"use client";

import {
  MONTHS_LONG,
  addDays,
  formatDateKey,
  formatUndoSnapshotHint,
  parseDate,
} from "@/lib/date-helpers";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { heuristicCrowdToneFromNoteText } from "@/lib/planner-crowd-level-meta";
import { parkChromaTileStyle } from "@/lib/theme-colours";
import {
  normaliseThemeKey,
  themedEmptySlotSurfaceStyle,
  type ThemeKey,
} from "@/lib/themes";
import type {
  Assignments,
  Park,
  SlotType,
  Trip,
} from "@/lib/types";
import Link from "next/link";
import {
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

const SWIPE_THRESHOLD = 50;

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
}: {
  days: MobilePlannerDay[];
  activeIndex: number;
  onJumpTo: (i: number) => void;
}) {
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = chipRefs.current[activeIndex];
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <div className="scrollbar-hide sticky top-0 z-20 overflow-x-auto border-b border-gold/20 bg-cream">
      <div className="flex min-w-max gap-2 px-4 py-3">
        {days.map((day, i) => (
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
        ))}
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
          <div className="truncate font-sans text-lg font-medium" style={{ color: "inherit" }}>
            {mealPrefix(slot)}
            {park.icon ? `${park.icon} ` : ""}
            {park.name}
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
}: MobileDayViewProps) {
  void _crowdSummary;
  const notesPanelId = useId();
  const days = useMemo(
    () => buildTripDays(trip, dayNotes, userDayNotes),
    [trip, dayNotes, userDayNotes],
  );

  const todayIndex = useMemo(
    () => days.findIndex((d) => isSameDay(d.date, new Date())),
    [days],
  );

  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = days.findIndex((d) => isSameDay(d.date, new Date()));
    return idx >= 0 ? idx : 0;
  });

  useEffect(() => {
    if (days.length === 0) return;
    setActiveIndex((i) => Math.min(i, days.length - 1));
  }, [days.length]);

  useEffect(() => {
    if (days.length === 0) return;
    const ti = days.findIndex((d) => isSameDay(d.date, new Date()));
    setActiveIndex(ti >= 0 ? ti : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when switching trips
  }, [trip.id]);

  const [parksDrawerOpen, setParksDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dayNotesOpen, setDayNotesOpen] = useState(false);
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
    if (distance > SWIPE_THRESHOLD) {
      setActiveIndex((i) => Math.min(days.length - 1, i + 1));
    } else if (distance < -SWIPE_THRESHOLD) {
      setActiveIndex((i) => Math.max(0, i - 1));
    }
  }, [days.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dayNotesOpen) setDayNotesOpen(false);
        else if (menuOpen) setMenuOpen(false);
        else if (parksDrawerOpen) {
          setParksDrawerOpen(false);
          setPendingSlot(null);
        }
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (parksDrawerOpen || menuOpen || dayNotesOpen) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(days.length - 1, i + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [days.length, parksDrawerOpen, menuOpen, dayNotesOpen]);

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

  return (
    <div className="md:hidden">
      <MobileDayStrip
        days={days}
        activeIndex={safeIndex}
        onJumpTo={setActiveIndex}
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
          <div className="mb-4">
            <div className="font-sans text-xs font-semibold uppercase tracking-wider text-gold">
              Day {safeIndex + 1} of {days.length}
            </div>
            <h2 className="font-serif text-3xl font-bold uppercase text-royal">
              {dayOfWeekLong(activeDay.date)}
            </h2>
            <div className="font-sans text-sm text-royal/70">
              {formatDateLong(activeDay.date)}
            </div>
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
          </div>

          <div className="space-y-3">
            {SLOTS.map(({ key: slot }) => {
              const ass = assignments[activeDay.dateKey] ?? {};
              const id = ass[slot];
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

          <div className="mt-6 flex items-center justify-between px-2">
            {safeIndex > 0 ? (
              <button
                type="button"
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
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
                onClick={() =>
                  setActiveIndex((i) => Math.min(days.length - 1, i + 1))
                }
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

      {isTodayInRange && safeIndex !== todayIndex ? (
        <button
          type="button"
          onClick={() => setActiveIndex(todayIndex)}
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-gold px-4 py-3 font-sans font-medium text-royal shadow-lg transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-royal/40 md:hidden"
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
    </div>
  );
}
