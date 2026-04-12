"use client";

import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { addDays, formatDateKey, parseDate } from "@/lib/date-helpers";
import { dayConditionRow } from "@/lib/planner-day-conditions";
import { parkChromaTileStyle } from "@/lib/theme-colours";
import { normaliseThemeKey, type ThemeKey } from "@/lib/themes";
import type { Assignment, Park, SlotType, TemperatureUnit, Trip } from "@/lib/types";
import { useMemo, useState } from "react";

const SLOTS: { key: SlotType; label: string }[] = [
  { key: "am", label: "AM" },
  { key: "lunch", label: "Lunch" },
  { key: "pm", label: "PM" },
  { key: "dinner", label: "Dinner" },
];

type Props = {
  trip: Trip;
  parks: Park[];
  assignments: Record<string, Assignment>;
  colourTheme: ThemeKey;
  plannerRegionId: string | null;
  temperatureUnit: TemperatureUnit;
  userDayNotes: Record<string, string>;
  onSaveUserDayNote?: (dateKey: string, text: string) => void;
  onTransferSlot: (
    fromDate: string,
    fromSlot: SlotType,
    toDate: string,
    toSlot: SlotType,
  ) => void;
  onExit: () => void;
};

function dayKeysForTrip(trip: Trip): string[] {
  const keys: string[] = [];
  let d = parseDate(trip.start_date);
  const end = parseDate(trip.end_date);
  while (d.getTime() <= end.getTime()) {
    keys.push(formatDateKey(d));
    d = addDays(d, 1);
  }
  return keys;
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function CompareDaysPanel({
  trip,
  parks,
  assignments,
  colourTheme,
  plannerRegionId,
  temperatureUnit,
  userDayNotes,
  onSaveUserDayNote,
  onTransferSlot,
  onExit,
}: Props) {
  const keys = useMemo(() => dayKeysForTrip(trip), [trip]);
  const [left, setLeft] = useState(keys[0] ?? "");
  const [right, setRight] = useState(keys[Math.min(1, keys.length - 1)] ?? "");
  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);
  const themeKey = normaliseThemeKey(colourTheme);
  const regionForConditions = plannerRegionId ?? trip.region_id;

  const renderColumn = (side: "left" | "right", dateKey: string) => {
    const day = assignments[dateKey] ?? {};
    const dayDate = dateFromKey(dateKey);
    const dc = dayConditionRow(regionForConditions, dayDate, temperatureUnit);
    const note = userDayNotes[dateKey] ?? "";
    const heading = dayDate.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    return (
      <div className="flex min-w-0 flex-1 flex-col rounded-xl border border-royal/12 bg-white/90 p-3 shadow-sm">
        <label className="font-sans text-xs font-semibold text-royal/70">
          {side === "left" ? "Day 1" : "Day 2"}
          <select
            className="mt-1 w-full min-h-[44px] rounded-lg border border-royal/20 bg-cream px-2 font-sans text-sm text-royal"
            value={dateKey}
            onChange={(e) =>
              side === "left"
                ? setLeft(e.target.value)
                : setRight(e.target.value)
            }
          >
            {keys.map((k) => (
              <option key={k} value={k}>
                {dateFromKey(k).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-1 font-sans text-[0.65rem] text-royal/55">{heading}</p>
        {dc ? (
          <p
            className="mt-2 font-sans text-[0.65rem] text-royal/65"
            title={dc.tooltip}
          >
            {dc.conditions.weatherEmoji} {dc.tempLabel} · crowds: {dc.crowd}
          </p>
        ) : null}
        <div className="mt-3 space-y-2">
          {SLOTS.map(({ key: slot, label }) => {
            const raw = day[slot];
            const id = getParkIdFromSlotValue(raw);
            const park = id ? parkById.get(id) : undefined;
            return (
              <div
                key={slot}
                draggable={Boolean(id)}
                onDragStart={(e) => {
                  if (!id) return;
                  e.dataTransfer.setData(
                    "application/triptiles-slot",
                    JSON.stringify({ dateKey, slot }),
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const rawData = e.dataTransfer.getData(
                    "application/triptiles-slot",
                  );
                  if (!rawData) return;
                  try {
                    const o = JSON.parse(rawData) as {
                      dateKey: string;
                      slot: SlotType;
                    };
                    if (o.dateKey === dateKey && o.slot === slot) return;
                    onTransferSlot(o.dateKey, o.slot, dateKey, slot);
                  } catch {
                    /* ignore */
                  }
                }}
                className="min-h-[48px] rounded-lg border border-dashed border-royal/15 px-2 py-1"
                style={
                  park
                    ? parkChromaTileStyle(
                        park.bg_colour,
                        park.fg_colour,
                        themeKey,
                      )
                    : undefined
                }
              >
                <div className="font-sans text-[0.6rem] font-semibold uppercase text-royal/70">
                  {label}
                </div>
                <div className="truncate font-sans text-xs font-medium">
                  {park
                    ? `${park.icon ? `${park.icon} ` : ""}${park.name}`
                    : "Drop a tile here"}
                </div>
              </div>
            );
          })}
        </div>
        {onSaveUserDayNote ? (
          <textarea
            className="mt-3 min-h-[4rem] w-full rounded-lg border border-royal/15 bg-cream/50 px-2 py-1 font-sans text-xs text-royal"
            placeholder="Notes for this day…"
            defaultValue={note}
            onBlur={(e) => onSaveUserDayNote(dateKey, e.target.value)}
            maxLength={500}
          />
        ) : (
          <p className="mt-3 font-sans text-xs text-royal/60">{note || "—"}</p>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6 rounded-2xl border border-royal/15 bg-cream/90 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-serif text-lg font-semibold text-royal">
          Compare days
        </h3>
        <button
          type="button"
          className="min-h-[44px] rounded-lg border border-royal/25 bg-white px-4 font-sans text-sm font-semibold text-royal"
          onClick={onExit}
        >
          Exit compare
        </button>
      </div>
      <p className="mt-1 font-sans text-xs text-royal/60">
        Drag a filled slot onto another to swap plans between those slots.
      </p>
      <div className="mt-4 flex flex-col gap-4 md:flex-row">
        {renderColumn("left", left)}
        {renderColumn("right", right)}
      </div>
    </div>
  );
}
