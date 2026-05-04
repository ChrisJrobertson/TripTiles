"use client";

import { CrowdLevelIndicator } from "@/components/planner/CrowdLevelIndicator";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import {
  addDays,
  formatDateISO,
  formatDateKey,
  MONTHS_LONG,
  MONTHS_SHORT,
  parseDate,
} from "@/lib/date-helpers";
import { heuristicCrowdToneFromNoteText } from "@/lib/planner-crowd-level-meta";
import { crowdLevelFromHeuristicTone } from "./CrowdLevelIndicator";
import type { Trip } from "@/lib/types";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

function stripTime(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function crowdLabel(tone: "low" | "mid" | "high"): string {
  if (tone === "low") return "quiet";
  if (tone === "high") return "busy";
  return "moderate";
}

function formatDayHeading(d: Date): string {
  const mon = MONTHS_SHORT[d.getMonth()];
  return `${mon} ${d.getDate()}, ${d.getFullYear()}`;
}

function tripDayNumber(trip: Trip, dateKey: string): number {
  const start = stripTime(parseDate(trip.start_date));
  const d = stripTime(parseDate(dateKey));
  return Math.round((d - start) / 86400000) + 1;
}

export type PlannerStripDay = {
  dateKey: string;
  date: Date;
  crowdDot: "low" | "mid" | "high" | null;
  crowdLabel: string | null;
  aiNote: string | null;
  userNote: string | null;
};

function buildStripDays(
  trip: Trip,
  dayNotes: Record<string, string>,
  userDayNotes: Record<string, string>,
): PlannerStripDay[] {
  const start = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  const out: PlannerStripDay[] = [];
  for (let d = new Date(start); stripTime(d) <= stripTime(end); d = addDays(d, 1)) {
    const dateKey = formatDateKey(d);
    const rawAi = dayNotes[dateKey];
    const aiSan =
      typeof rawAi === "string" && rawAi.trim()
        ? sanitizeDayNote(rawAi.trim())
        : null;
    const rawUser = userDayNotes[dateKey];
    const userSan =
      typeof rawUser === "string" && rawUser.trim()
        ? rawUser.trim()
        : null;
    const tone = heuristicCrowdToneFromNoteText(aiSan);
    out.push({
      dateKey,
      date: new Date(d),
      crowdDot: tone,
      crowdLabel: tone ? crowdLabel(tone) : null,
      aiNote: aiSan,
      userNote: userSan,
    });
  }
  return out;
}

function dayOfWeekShort(d: Date): string {
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()] ?? "";
}

function formatDateLong(d: Date): string {
  const day = d.getDate();
  const mon = MONTHS_LONG[d.getMonth()];
  const y = d.getFullYear();
  return `${day} ${mon} ${y}`;
}

type StripNoteState = {
  dateKey: string;
  headingDate: string;
  crowdLine: string | null;
  dayNote: string;
};

type Props = {
  trip: Trip;
  tripRouteBase: string;
  /** preferences.ai_day_crowd_notes */
  dayNotes: Record<string, string>;
  /** preferences.day_notes (user) */
  userDayNotes?: Record<string, string>;
};

/** Mobile-only horizontal day strip linking to `/trip/[id]/day/[date]` (calendar overview). */
export function MobileTripCalendarStripNav({
  trip,
  tripRouteBase,
  dayNotes,
  userDayNotes = {},
}: Props) {
  const days = useMemo(
    () => buildStripDays(trip, dayNotes, userDayNotes),
    [trip, dayNotes, userDayNotes],
  );
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const sheetId = useId();
  const noteToggleTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [noteSheet, setNoteSheet] = useState<StripNoteState | null>(null);

  const closeNoteSheet = useCallback(() => {
    setNoteSheet(null);
    queueMicrotask(() => {
      const el = noteToggleTriggerRef.current;
      noteToggleTriggerRef.current = null;
      el?.focus();
    });
  }, []);

  const todayIso = formatDateISO(new Date());
  const todayIndex = useMemo(
    () => days.findIndex((d) => d.dateKey === todayIso),
    [days, todayIso],
  );

  useEffect(() => {
    if (todayIndex < 0) return;
    const el = chipRefs.current[todayIndex];
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [todayIndex]);

  useEffect(() => {
    if (!noteSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeNoteSheet();
        return;
      }
      if (e.key !== "Tab") return;
      const root = sheetRef.current;
      if (!root) return;
      const nodes = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const frame = window.requestAnimationFrame(() => {
      const root = sheetRef.current;
      const closeBtn = root?.querySelector<HTMLElement>('[aria-label="Close"]');
      (closeBtn ?? root?.querySelector("button"))?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
    };
  }, [noteSheet, closeNoteSheet]);

  useEffect(() => {
    if (!noteSheet) return;
    const onPointer = (e: Event) => {
      const el = sheetRef.current;
      const t = e.target as Node;
      if (el?.contains(t)) return;
      if ((t as Element).closest?.("[data-strip-day-note-toggle]")) return;
      closeNoteSheet();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [noteSheet, closeNoteSheet]);

  if (days.length === 0) return null;

  return (
    <nav
      className="scrollbar-hide md:hidden relative overflow-x-auto border-b border-gold/20 bg-white/50"
      aria-label="Jump to a trip day"
    >
      <div className="flex min-w-max gap-2 px-4 py-3">
        {days.map((day, i) => {
          const iso = formatDateISO(parseDate(day.dateKey));
          const isToday = iso === todayIso;
          const href = `${tripRouteBase}/day/${iso}`;
          const hasInsight = Boolean(day.aiNote || day.userNote);
          const headingDate = formatDayHeading(day.date);
          const openStripNote = (anchor: HTMLButtonElement) => {
            noteToggleTriggerRef.current = anchor;
            setNoteSheet({
              dateKey: day.dateKey,
              headingDate,
              crowdLine: day.aiNote,
              dayNote: day.userNote ?? "",
            });
          };

          const chipShell = isToday
            ? "flex min-w-[56px] items-stretch overflow-hidden rounded-lg border-2 border-gold/55 bg-white font-bold text-royal shadow-sm ring-2 ring-gold/25 transition"
            : "flex min-w-[56px] items-stretch overflow-hidden rounded-lg border border-gold/30 bg-white font-bold text-royal transition active:bg-cream";

          return (
            <div
              key={day.dateKey}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              className={chipShell}
            >
              <Link
                href={href}
                scroll={false}
                prefetch={false}
                aria-current={isToday ? "date" : undefined}
                aria-label={`Open day planner: ${formatDateLong(day.date)}`}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-royal focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-inset"
              >
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    isToday ? "text-royal/75" : "text-royal/60"
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
              {hasInsight ? (
                <button
                  type="button"
                  data-strip-day-note-toggle
                  title="Day tips and notes — tap to read"
                  aria-label={`Show day note for ${headingDate}`}
                  aria-expanded={noteSheet?.dateKey === day.dateKey}
                  aria-controls={`${sheetId}-panel`}
                  className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center self-stretch border-l border-gold/30 bg-gold/15 px-0.5 text-lg leading-none text-royal transition hover:bg-gold/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-inset"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const btn = e.currentTarget;
                    if (noteSheet?.dateKey === day.dateKey) {
                      closeNoteSheet();
                    } else {
                      openStripNote(btn);
                    }
                  }}
                >
                  <span aria-hidden>💡</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="px-4 pb-3 font-sans text-xs leading-relaxed text-royal/65">
        Tap a day to edit slots, rides, and notes — or pick a tile from the drawer on larger screens.
      </p>

      {noteSheet ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-royal/20"
            aria-hidden
            onClick={closeNoteSheet}
          />
          <div
            ref={sheetRef}
            id={`${sheetId}-panel`}
            role="dialog"
            aria-modal="true"
            aria-label="Day note"
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[50vh] overflow-y-auto rounded-t-xl border border-royal bg-white p-4 shadow-lg"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="font-sans text-sm font-semibold text-royal">
                Day {tripDayNumber(trip, noteSheet.dateKey)} · {noteSheet.headingDate}
              </h3>
              <button
                type="button"
                className="rounded px-1.5 text-lg leading-none text-royal/60 transition hover:bg-cream hover:text-royal focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                aria-label="Close"
                onClick={closeNoteSheet}
              >
                ×
              </button>
            </div>
            {noteSheet.crowdLine ? (
              <p className="mb-2 font-sans text-xs leading-relaxed text-royal/85">
                <span className="font-semibold text-royal">Why this day: </span>
                {noteSheet.crowdLine}
              </p>
            ) : null}
            {noteSheet.dayNote ? (
              <p className="font-sans text-xs leading-relaxed text-royal/85">
                <span className="font-semibold text-royal">Your note: </span>
                {noteSheet.dayNote}
              </p>
            ) : null}
            {!noteSheet.crowdLine && !noteSheet.dayNote ? (
              <p className="font-sans text-xs leading-relaxed text-royal/70">
                No tips or notes for this day.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </nav>
  );
}
