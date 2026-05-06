"use client";

import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { parseDate } from "@/lib/date-helpers";
import { buildAmPmPresentation } from "@/lib/planner-am-pm-display";
import type { CrowdLevel } from "@/lib/planner-crowd-level-meta";
import type { Assignment, Park, SlotType, TemperatureUnit, Trip } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { CrowdLevelIndicator } from "@/components/planner/CrowdLevelIndicator";
import { useMemo } from "react";

const SLOT_ORDER: {
  slot: SlotType;
  stubTime: string;
}[] = [
  { slot: "am", stubTime: "09:00" },
  { slot: "pm", stubTime: "14:00" },
  { slot: "lunch", stubTime: "12:30" },
  { slot: "dinner", stubTime: "19:00" },
];

function stripTime(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function tripDayNumber(trip: Trip, dateKey: string): number {
  const start = stripTime(parseDate(trip.start_date));
  const d = stripTime(parseDate(dateKey));
  return Math.round((d - start) / 86400000) + 1;
}

function primaryDayTitle(
  assignment: Assignment,
  parkById: Map<string, Park>,
): string {
  const p = buildAmPmPresentation(assignment, parkById);
  if (p.mode === "unified_rest_day") return "Rest day";
  if (p.mode === "unified_travel_day") return p.park.name;
  if (p.mode === "unified_full_day") return p.park.name;
  const bits: string[] = [];
  if (p.morning.state === "park") bits.push(p.morning.park.name);
  if (p.afternoon.state === "park") bits.push(p.afternoon.park.name);
  if (bits.length) return [...new Set(bits)].join(" · ");
  return "Flexible day";
}

type Props = {
  trip: Trip;
  dateKey: string | null;
  parks: Park[];
  plannerRegionId: string | null;
  temperatureUnit: TemperatureUnit;
  weatherChip: string | null;
  crowdLevel: CrowdLevel | null;
  undoAiAvailable: boolean;
  onClearSelection: () => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onPlanThisDay: () => void;
  onUndoAi: () => void;
  onShareDay?: () => void;
  onEditDay: () => void;
};

export function PlannerDayTimelineStub({
  trip,
  dateKey,
  parks,
  weatherChip,
  crowdLevel,
  undoAiAvailable,
  onClearSelection,
  onPrevDay,
  onNextDay,
  onPlanThisDay,
  onUndoAi,
  onShareDay,
  onEditDay,
}: Props) {
  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);

  const totalDays = useMemo(() => {
    const s = stripTime(parseDate(trip.start_date));
    const e = stripTime(parseDate(trip.end_date));
    return Math.round((e - s) / 86400000) + 1;
  }, [trip.start_date, trip.end_date]);

  if (!dateKey) {
    return (
      <section className="mt-6 rounded-tt-xl border border-tt-line bg-tt-surface shadow-tt-md">
        <div className="rounded-t-tt-xl bg-tt-royal px-4 py-3">
          <p className="font-meta text-[11px] font-semibold uppercase tracking-wide text-cream/85">
            Day timeline
          </p>
          <p className="font-heading text-lg font-semibold text-cream">
            Select a day on the calendar
          </p>
        </div>
        <div className="px-4 py-12 text-center font-sans text-sm text-tt-ink-muted">
          Tap a calendar day to see your AM/PM and meals here, or use{" "}
          <span className="font-semibold text-tt-royal">×</span> to clear the
          selection.
        </div>
      </section>
    );
  }

  const assignment = trip.assignments[dateKey] ?? {};
  const dayIdx = tripDayNumber(trip, dateKey);
  const headingDate = parseDate(`${dateKey}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const title = primaryDayTitle(assignment, parkById);

  const filledRows = SLOT_ORDER.flatMap(({ slot, stubTime }) => {
    const pid = getParkIdFromSlotValue(assignment[slot]);
    if (!pid) return [];
    const park = parkById.get(pid);
    const name = park?.name ?? pid;
    const icon = park?.icon ?? "📍";
    return [{ slot, stubTime, name, icon }];
  });

  const dayNoteRaw = trip.preferences?.day_notes;
  const dayNote =
    dayNoteRaw &&
    typeof dayNoteRaw === "object" &&
    !Array.isArray(dayNoteRaw) &&
    typeof (dayNoteRaw as Record<string, unknown>)[dateKey] === "string"
      ? String((dayNoteRaw as Record<string, string>)[dateKey]).trim()
      : "";

  return (
    <section className="mt-6 overflow-hidden rounded-tt-xl border border-tt-line bg-white shadow-tt-md">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-tt-royal px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="font-meta text-[10px] font-semibold uppercase tracking-wide text-cream/80">
            Day {dayIdx} of {totalDays} · {headingDate.toUpperCase()}
          </p>
          <p className="mt-1 font-heading text-xl font-semibold tracking-tight text-cream">
            {title}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-9 border border-cream/25 text-cream hover:bg-white/10"
            onClick={onPrevDay}
            aria-label="Previous day"
          >
            ←
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-9 border border-cream/25 text-cream hover:bg-white/10"
            onClick={onNextDay}
            aria-label="Next day"
          >
            →
          </Button>
          {onShareDay ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-9 border border-cream/25 text-cream hover:bg-white/10"
              onClick={onShareDay}
            >
              Share
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-9 border border-cream/25 px-3 text-lg leading-none text-cream hover:bg-white/10"
            onClick={onClearSelection}
            aria-label="Clear day selection"
          >
            ×
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-tt-line-soft bg-tt-bg-soft/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" size="sm" onClick={onPlanThisDay}>
            Plan this day ✨
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!undoAiAvailable}
            onClick={onUndoAi}
          >
            Undo last AI change
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onEditDay}>
            Edit day
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-tt-line bg-tt-surface px-2.5 py-1 font-meta text-[11px] font-semibold text-tt-ink">
            {weatherChip ?? "—"}
          </span>
          {crowdLevel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-tt-line bg-tt-surface px-2 py-1 font-meta text-[11px] font-semibold capitalize text-tt-ink">
              <CrowdLevelIndicator level={crowdLevel} size="sm" />
              {crowdLevel}
            </span>
          ) : (
            <span className="font-meta text-[11px] text-tt-ink-soft">Crowd —</span>
          )}
        </div>
      </div>

      <div className="divide-y divide-tt-line-soft bg-white px-0">
        {filledRows.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="font-sans text-sm text-tt-ink-muted">
              Nothing planned for this day yet — drag a tile onto the calendar or tap{" "}
              <span className="font-semibold text-tt-royal">Plan this day ✨</span>.
            </p>
          </div>
        ) : (
          filledRows.map(({ slot, stubTime, icon, name }, i) => (
            <div
              key={slot}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                <span className="w-14 shrink-0 font-mono text-xs font-semibold text-tt-ink-muted">
                  {stubTime}
                </span>
                <span className="text-lg" aria-hidden>
                  {icon}
                </span>
                <div className="min-w-0">
                  <p className="font-sans text-sm font-semibold text-tt-ink">{name}</p>
                  {dayNote && i === 0 ? (
                    <p className="mt-1 font-sans text-xs leading-snug text-tt-ink-muted">
                      {dayNote}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-end sm:pt-0.5">
                <Button type="button" variant="ghost" size="sm" onClick={onEditDay}>
                  Edit
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
