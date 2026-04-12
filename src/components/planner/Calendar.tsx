"use client";

import {
  DAYS_OF_WEEK,
  MONTHS_SHORT,
  addDays,
  endOfWeekSunday,
  formatDateKey,
  parseDate,
  startOfWeekMonday,
} from "@/lib/date-helpers";
import { sanitizeDayNote } from "@/lib/ai-sanitize-notes";
import { heuristicCrowdToneFromNoteText } from "@/lib/planner-crowd-level-meta";
import {
  themedEmptySlotSurfaceStyle,
  themedTileChromeStyle,
} from "@/lib/themes";
import type { Assignment, Park, SlotType, Trip } from "@/lib/types";
import {
  CrowdLevelIndicator,
  crowdLevelFromHeuristicTone,
} from "@/components/planner/CrowdLevelIndicator";
import type { CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Props = {
  trip: Trip;
  parks: Park[];
  selectedParkId: string | null;
  onAssign: (dateKey: string, slot: SlotType, parkId: string) => void;
  onClear: (dateKey: string, slot: SlotType) => void;
  onNeedParkFirst: () => void;
  /** Optional toast after double-click clear (desktop). */
  onAfterSlotClear?: () => void;
  /** Read-only grid (e.g. public share page). */
  readOnly?: boolean;
};

const SLOTS: { key: SlotType; label: string; area: string }[] = [
  { key: "am", label: "AM", area: "planner-slot-am" },
  { key: "pm", label: "PM", area: "planner-slot-pm" },
  { key: "lunch", label: "LUN", area: "planner-slot-lunch" },
  { key: "dinner", label: "DIN", area: "planner-slot-dinner" },
];

function stripTime(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function inTripRange(day: Date, trip: Trip): boolean {
  const t = stripTime(day);
  const s = stripTime(parseDate(trip.start_date));
  const e = stripTime(parseDate(trip.end_date));
  return t >= s && t <= e;
}

function dayCrowdNote(trip: Trip, dateKey: string): string | null {
  const raw = trip.preferences?.ai_day_crowd_notes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = (raw as Record<string, unknown>)[dateKey];
  if (typeof v !== "string" || !v.trim()) return null;
  return sanitizeDayNote(v.trim());
}

function dayUserNote(trip: Trip, dateKey: string): string {
  const dnRaw = trip.preferences?.day_notes;
  if (!dnRaw || typeof dnRaw !== "object" || Array.isArray(dnRaw)) return "";
  const v = (dnRaw as Record<string, unknown>)[dateKey];
  return typeof v === "string" ? v.trim() : "";
}

function tripDayNumber(trip: Trip, dateKey: string): number {
  const start = stripTime(parseDate(trip.start_date));
  const d = stripTime(parseDate(dateKey));
  return Math.round((d - start) / 86400000) + 1;
}

function formatDayHeading(day: Date): string {
  const mon = MONTHS_SHORT[day.getMonth()];
  return `${mon} ${day.getDate()}, ${day.getFullYear()}`;
}

function buildWeeks(trip: Trip): Date[][] {
  const start = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  const gridStart = startOfWeekMonday(start);
  const gridEnd = endOfWeekSunday(end);
  const days: Date[] = [];
  for (
    let d = new Date(gridStart);
    stripTime(d) <= stripTime(gridEnd);
    d = addDays(d, 1)
  ) {
    days.push(new Date(d));
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

type NotePopoverState = {
  dateKey: string;
  headingDate: string;
  crowdLine: string | null;
  dayNote: string;
  anchorRect: DOMRect;
};

function deskPopoverPosition(anchor: DOMRect): { top: number; left: number } {
  const approxH = 220;
  let top = anchor.bottom + 8;
  if (typeof window !== "undefined" && top + approxH > window.innerHeight - 16) {
    top = Math.max(8, anchor.top - approxH - 8);
  }
  const left =
    typeof window !== "undefined"
      ? Math.max(8, Math.min(anchor.left, window.innerWidth - 8 - 300))
      : anchor.left;
  return { top, left };
}

export function Calendar({
  trip,
  parks,
  selectedParkId,
  onAssign,
  onClear,
  onNeedParkFirst,
  onAfterSlotClear,
  readOnly = false,
}: Props) {
  const parkById = new Map(parks.map((p) => [p.id, p]));
  const weeks = buildWeeks(trip);
  const crowdToneByDateKey = useMemo(() => {
    const m = new Map<string, "low" | "mid" | "high" | null>();
    const raw = trip.preferences?.ai_day_crowd_notes;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return m;
    for (const [dk, val] of Object.entries(raw)) {
      if (typeof val !== "string" || !val.trim()) continue;
      m.set(dk, heuristicCrowdToneFromNoteText(sanitizeDayNote(val.trim())));
    }
    return m;
  }, [trip.preferences?.ai_day_crowd_notes]);
  const popoverId = useId();
  const [notePopover, setNotePopover] = useState<NotePopoverState | null>(
    null,
  );
  const [popoverDeskPos, setPopoverDeskPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const closeNotePopover = useCallback(() => {
    setNotePopover(null);
    setPopoverDeskPos(null);
  }, []);

  useEffect(() => {
    if (!notePopover) return;
    const place = () => {
      if (typeof window === "undefined") return;
      if (window.innerWidth < 768) {
        setPopoverDeskPos(null);
        return;
      }
      setPopoverDeskPos(deskPopoverPosition(notePopover.anchorRect));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [notePopover]);

  useEffect(() => {
    if (!notePopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNotePopover();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [notePopover, closeNotePopover]);

  useEffect(() => {
    if (!notePopover) return;
    const onPointer = (e: Event) => {
      const el = popoverRef.current;
      const t = e.target as Node;
      if (el?.contains(t)) return;
      if ((t as Element).closest?.("[data-day-note-toggle]")) return;
      closeNotePopover();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [notePopover, closeNotePopover]);

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <div className="w-full min-w-[min(100%,64rem)]">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
        >
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className="bg-royal py-2 text-center font-sans text-[0.65rem] font-semibold text-gold sm:text-xs"
            >
              {d}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="mt-1 grid gap-1"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {week.map((day) => {
              const key = formatDateKey(day);
              const inRange = inTripRange(day, trip);
              const ass: Assignment = trip.assignments[key] ?? {};

              if (!inRange) {
                return (
                  <div
                    key={key}
                    className="min-h-[8rem] rounded-md bg-transparent sm:min-h-[9rem] md:min-h-[5.5rem]"
                  />
                );
              }

              const dayNum = day.getDate();
              const mon = MONTHS_SHORT[day.getMonth()];
              const crowdLine = dayCrowdNote(trip, key);
              const dayNote = dayUserNote(trip, key);
              const hasInsight = Boolean(crowdLine || dayNote);
              const tone = crowdToneByDateKey.get(key) ?? null;
              const crowdLevel = tone ? crowdLevelFromHeuristicTone(tone) : null;
              const headingDate = formatDayHeading(day);

              const openNote = (anchor: DOMRect) => {
                const next: NotePopoverState = {
                  dateKey: key,
                  headingDate,
                  crowdLine,
                  dayNote,
                  anchorRect: anchor,
                };
                setNotePopover(next);
                if (
                  typeof window !== "undefined" &&
                  window.innerWidth >= 768
                ) {
                  setPopoverDeskPos(deskPopoverPosition(anchor));
                } else {
                  setPopoverDeskPos(null);
                }
              };

              const isPopoverThisDay =
                notePopover?.dateKey === key && hasInsight;

              return (
                <div
                  key={key}
                  className="flex min-h-[8rem] flex-col rounded-md border border-royal/15 bg-white sm:min-h-[9rem] md:min-h-[5.75rem]"
                >
                  <div className="flex items-center justify-between gap-0.5 border-b border-royal/10 px-1 py-0.5 md:py-1">
                    <div className="min-w-0 flex flex-1 items-center justify-center gap-1 text-center">
                      {crowdLevel ? (
                        <span className="hidden shrink-0 md:inline-flex">
                          <CrowdLevelIndicator level={crowdLevel} size="sm" />
                        </span>
                      ) : null}
                      <span className="font-serif text-lg font-bold leading-none text-royal sm:text-xl">
                        {dayNum}
                      </span>
                      <span className="font-sans text-[0.6rem] font-medium uppercase text-royal/60 sm:text-[0.65rem]">
                        {mon}
                      </span>
                    </div>
                    {hasInsight ? (
                      <button
                        type="button"
                        data-day-note-toggle
                        className="shrink-0 rounded p-0.5 text-base leading-none text-royal/70 transition hover:bg-cream hover:text-royal focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                        aria-label={`Day notes for ${headingDate}`}
                        aria-expanded={isPopoverThisDay}
                        aria-controls={`${popoverId}-note-panel`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const r = (
                            e.currentTarget as HTMLButtonElement
                          ).getBoundingClientRect();
                          if (notePopover?.dateKey === key) {
                            closeNotePopover();
                          } else {
                            openNote(r);
                          }
                        }}
                      >
                        💡
                      </button>
                    ) : (
                      <span className="w-6 shrink-0" aria-hidden />
                    )}
                  </div>
                  <div className="planner-slot-grid flex-1 p-0.5">
                    {SLOTS.map(({ key: slot, label, area }) => {
                      const pid = ass[slot];
                      const park = pid ? parkById.get(pid) : undefined;
                      const isMeal = slot === "lunch" || slot === "dinner";
                      const mealPrefix = isMeal ? "🍽️ " : "";
                      const slotAria = park
                        ? `${label} slot: ${park.name}`
                        : `${label} slot: empty`;
                      const emptySlotStyle: CSSProperties | undefined = park
                        ? undefined
                        : themedEmptySlotSurfaceStyle();
                      const filledSlotStyle: CSSProperties | undefined =
                        park
                          ? themedTileChromeStyle(park.bg_colour)
                          : undefined;
                      return (
                        <div
                          key={slot}
                          className={`group planner-slot relative flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-royal/10 ${area} ${
                            park
                              ? "transition hover:brightness-[1.06]"
                              : ""
                          } ${
                            readOnly || park
                              ? ""
                              : "cursor-pointer hover:brightness-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/50 focus-visible:ring-inset"
                          }`}
                          style={park ? filledSlotStyle : emptySlotStyle}
                          role={readOnly || park ? undefined : "button"}
                          tabIndex={readOnly || park ? undefined : 0}
                          aria-label={slotAria}
                          title={slotAria}
                          onClick={() => {
                            if (readOnly) return;
                            if (park) return;
                            if (selectedParkId) {
                              onAssign(key, slot, selectedParkId);
                            } else {
                              onNeedParkFirst();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (readOnly) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (!park) {
                                if (selectedParkId) {
                                  onAssign(key, slot, selectedParkId);
                                } else {
                                  onNeedParkFirst();
                                }
                              }
                            }
                          }}
                        >
                          <span className="planner-slot-label md:hidden">
                            {label}
                          </span>
                          {park ? (
                            <div
                              className="relative mt-2 flex min-h-0 flex-1 flex-row items-center gap-0.5 pl-0.5 pr-1 md:mt-0 md:items-stretch md:pl-1 md:pr-1"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (readOnly) return;
                                onClear(key, slot);
                                onAfterSlotClear?.();
                              }}
                            >
                              {!readOnly ? (
                                <button
                                  type="button"
                                  className="planner-slot-clear relative right-auto top-auto z-[1] flex h-5 w-5 shrink-0 items-center justify-center opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--tt-ring)]/55"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onClear(key, slot);
                                  }}
                                  aria-label="Clear slot"
                                >
                                  ×
                                </button>
                              ) : null}
                              <span className="line-clamp-3 min-w-0 flex-1 self-center font-sans text-[0.6rem] font-medium leading-tight sm:text-[0.65rem] md:self-center md:py-0.5">
                                {mealPrefix}
                                {park.icon ? `${park.icon} ` : ""}
                                {park.name}
                              </span>
                            </div>
                          ) : (
                            <span
                              className="mt-auto opacity-30 md:mt-0 md:flex md:flex-1 md:items-center md:justify-center"
                              aria-hidden
                            >
                              ·
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {notePopover ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-royal/20 md:hidden"
            aria-hidden
            onClick={closeNotePopover}
          />
          <div
            ref={popoverRef}
            id={`${popoverId}-note-panel`}
            role="dialog"
            aria-modal="true"
            aria-label="Day note"
            className="fixed z-50 max-h-[50vh] w-full overflow-y-auto rounded-t-xl border border-royal bg-white p-4 shadow-lg md:max-h-[min(70vh,24rem)] md:w-[min(300px,calc(100vw-16px))] md:rounded-lg md:p-3"
            style={
              popoverDeskPos
                ? {
                    top: popoverDeskPos.top,
                    left: popoverDeskPos.left,
                    right: "auto",
                    bottom: "auto",
                  }
                : { bottom: 0, left: 0, right: 0 }
            }
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h3 className="font-sans text-sm font-semibold text-royal">
                Day {tripDayNumber(trip, notePopover.dateKey)} ·{" "}
                {notePopover.headingDate}
              </h3>
              <button
                type="button"
                className="rounded px-1.5 text-lg leading-none text-royal/60 transition hover:bg-cream hover:text-royal focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                aria-label="Close"
                onClick={closeNotePopover}
              >
                ×
              </button>
            </div>
            {notePopover.crowdLine ? (
              <p className="mb-2 font-sans text-xs leading-relaxed text-royal/85">
                <span className="font-semibold text-royal">Why this day: </span>
                {notePopover.crowdLine}
              </p>
            ) : null}
            {notePopover.dayNote ? (
              <p className="font-sans text-xs leading-relaxed text-royal/85">
                <span className="font-semibold text-royal">Your note: </span>
                {notePopover.dayNote}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
