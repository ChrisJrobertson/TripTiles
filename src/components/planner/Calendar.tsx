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
import type { Assignment, Park, SlotType, Trip } from "@/lib/types";

type Props = {
  trip: Trip;
  parks: Park[];
  selectedParkId: string | null;
  onAssign: (dateKey: string, slot: SlotType, parkId: string) => void;
  onClear: (dateKey: string, slot: SlotType) => void;
  onNeedParkFirst: () => void;
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

function buildWeeks(trip: Trip): Date[][] {
  const start = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  const gridStart = startOfWeekMonday(start);
  const gridEnd = endOfWeekSunday(end);
  const days: Date[] = [];
  for (let d = new Date(gridStart); stripTime(d) <= stripTime(gridEnd); d = addDays(d, 1)) {
    days.push(new Date(d));
  }
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function Calendar({
  trip,
  parks,
  selectedParkId,
  onAssign,
  onClear,
  onNeedParkFirst,
}: Props) {
  const parkById = new Map(parks.map((p) => [p.id, p]));
  const weeks = buildWeeks(trip);

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-block min-w-full">
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
                    className="min-h-[8rem] rounded-md bg-transparent sm:min-h-[9rem]"
                  />
                );
              }

              const dayNum = day.getDate();
              const mon = MONTHS_SHORT[day.getMonth()];

              return (
                <div
                  key={key}
                  className="flex min-h-[8rem] flex-col rounded-md border border-royal/15 bg-white sm:min-h-[9rem]"
                >
                  <div className="border-b border-royal/10 px-1 py-1 text-center">
                    <span className="font-serif text-lg font-bold leading-none text-royal sm:text-xl">
                      {dayNum}
                    </span>
                    <span className="ml-1 font-sans text-[0.6rem] font-medium uppercase text-royal/60 sm:text-[0.65rem]">
                      {mon}
                    </span>
                  </div>
                  <div className="planner-slot-grid flex-1 p-0.5">
                    {SLOTS.map(({ key: slot, label, area }) => {
                      const pid = ass[slot];
                      const park = pid ? parkById.get(pid) : undefined;
                      return (
                        <div
                          key={slot}
                          className={`planner-slot ${area} ${
                            park ? "" : "cursor-pointer bg-cream/50 hover:bg-cream"
                          }`}
                          style={
                            park
                              ? {
                                  backgroundColor: park.bg_colour,
                                  color: park.fg_colour,
                                }
                              : undefined
                          }
                          onClick={() => {
                            if (park) return;
                            if (selectedParkId) {
                              onAssign(key, slot, selectedParkId);
                            } else {
                              onNeedParkFirst();
                            }
                          }}
                          onKeyDown={(e) => {
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
                          role={park ? undefined : "button"}
                          tabIndex={park ? undefined : 0}
                        >
                          <span className="planner-slot-label">{label}</span>
                          {park ? (
                            <>
                              <button
                                type="button"
                                className="planner-slot-clear"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onClear(key, slot);
                                }}
                                aria-label="Clear slot"
                              >
                                ×
                              </button>
                              <span className="mt-3 line-clamp-3 pl-0.5 pr-3 font-sans text-[0.6rem] font-medium leading-tight sm:text-[0.65rem]">
                                {park.icon ? `${park.icon} ` : ""}
                                {park.name}
                              </span>
                            </>
                          ) : (
                            <span className="mt-auto opacity-30" aria-hidden>
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
    </div>
  );
}
