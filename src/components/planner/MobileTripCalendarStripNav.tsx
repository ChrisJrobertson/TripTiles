"use client";

import { CrowdLevelIndicator } from "@/components/planner/CrowdLevelIndicator";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import {
  addDays,
  formatDateISO,
  formatDateKey,
  MONTHS_LONG,
  parseDate,
} from "@/lib/date-helpers";
import { heuristicCrowdToneFromNoteText } from "@/lib/planner-crowd-level-meta";
import { crowdLevelFromHeuristicTone } from "./CrowdLevelIndicator";
import type { Trip } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

function stripTime(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function crowdLabel(tone: "low" | "mid" | "high"): string {
  if (tone === "low") return "quiet";
  if (tone === "high") return "busy";
  return "moderate";
}

export type PlannerStripDay = {
  dateKey: string;
  date: Date;
  crowdDot: "low" | "mid" | "high" | null;
  crowdLabel: string | null;
  aiNote: string | null;
};

function buildStripDays(
  trip: Trip,
  dayNotes: Record<string, string>,
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
    const tone = heuristicCrowdToneFromNoteText(aiSan);
    out.push({
      dateKey,
      date: new Date(d),
      crowdDot: tone,
      crowdLabel: tone ? crowdLabel(tone) : null,
      aiNote: aiSan,
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

type Props = {
  trip: Trip;
  tripRouteBase: string;
  /** preferences.ai_day_crowd_notes */
  dayNotes: Record<string, string>;
};

/** Mobile-only horizontal day strip linking to `/trip/[id]/day/[date]` (calendar overview). */
export function MobileTripCalendarStripNav({
  trip,
  tripRouteBase,
  dayNotes,
}: Props) {
  const days = useMemo(
    () => buildStripDays(trip, dayNotes),
    [trip, dayNotes],
  );
  const chipRefs = useRef<(HTMLAnchorElement | null)[]>([]);

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
          return (
            <Link
              key={day.dateKey}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              href={href}
              scroll={false}
              prefetch={false}
              aria-current={isToday ? "date" : undefined}
              aria-label={`Open day planner: ${formatDateLong(day.date)}`}
              className={
                isToday
                  ? "flex min-w-[56px] flex-col items-center rounded-lg border-2 border-gold/55 bg-white px-3 py-2 font-bold text-royal shadow-sm ring-2 ring-gold/25 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                  : "flex min-w-[56px] flex-col items-center rounded-lg border border-gold/30 bg-white px-3 py-2 font-bold text-royal transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 active:bg-cream"
              }
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
          );
        })}
      </div>
      <p className="px-4 pb-3 font-sans text-xs leading-relaxed text-royal/65">
        Tap a day to edit slots, rides, and notes — or pick a tile from the drawer on larger screens.
      </p>
    </nav>
  );
}
