"use client";

import { AdventureTitleColorControl } from "@/components/planner/AdventureTitleColorControl";
import { EditableTitle } from "@/components/planner/EditableTitle";
import { SavingIndicator } from "@/components/planner/SavingIndicator";
import { useTripWorkspaceData } from "@/components/planner/state/TripWorkspaceData";
import { Badge } from "@/components/ui/Badge";
import { eachDateKeyInRange, MONTHS_SHORT, parseDate } from "@/lib/date-helpers";
import {
  buildTripWorkspaceModel,
  planningStatusLabel,
  type PlanningStatus,
  type WorkspaceAction,
} from "@/lib/trip-workspace-status";
import { resolvedAdventureTitleColor } from "@/lib/adventure-title-color";
import type { Park, Trip } from "@/lib/types";
import type { TripPayment } from "@/types/payments";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Props = {
  trip: Trip;
  trips: Trip[];
  parks: Park[];
  payments: TripPayment[];
  regionLabel: string;
  onSwitchTrip: (tripId: string) => void;
  onSaveFamilyName: (value: string) => void;
  onSaveAdventureName: (value: string) => void;
  onAdventureColorChange: (value: string | null) => void;
  showGoToToday: boolean;
  onGoToToday: () => void;
  isSaving: boolean;
  lastSavedAt: Date | null;
  onOpenSmartPlan: () => void;
  onOpenDay: (dateKey: string) => void;
};

function formatTripDateRange(startIso: string, endIso: string): string {
  const a = parseDate(startIso);
  const b = parseDate(endIso);
  const sameMonth =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameMonth) {
    return `${a.getDate()}–${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
  }
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = `${a.getDate()} ${MONTHS_SHORT[a.getMonth()]}`;
  const right = `${b.getDate()} ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
  return sameYear ? `${left} – ${right}` : `${left} ${a.getFullYear()} – ${right}`;
}

function partyLabel(trip: Trip): string {
  const bits: string[] = [];
  if (trip.adults > 0) {
    bits.push(`${trip.adults} adult${trip.adults === 1 ? "" : "s"}`);
  }
  if (trip.children > 0) {
    bits.push(`${trip.children} child${trip.children === 1 ? "" : "ren"}`);
  }
  return bits.length ? bits.join(", ") : "Party size not set";
}

function phaseCopy(trip: Trip, todayKey: string): {
  badge: string;
  countdown: string | null;
} {
  const start = trip.start_date.slice(0, 10);
  const end = trip.end_date.slice(0, 10);
  const total = Math.max(1, eachDateKeyInRange(start, end).length);
  if (todayKey > end) return { badge: "Past trip", countdown: null };
  if (todayKey >= start) {
    const day = eachDateKeyInRange(start, todayKey).length;
    return { badge: "Happening now", countdown: `Day ${day} of ${total}` };
  }
  const until = eachDateKeyInRange(todayKey, start).length - 1;
  if (until <= 0) return { badge: "Upcoming", countdown: "Starts today" };
  if (until === 1) return { badge: "Upcoming", countdown: "Tomorrow" };
  return { badge: "Upcoming", countdown: `In ${until} days` };
}

const STATUS_VARIANT: Record<
  PlanningStatus,
  "default" | "info" | "success" | "warning"
> = {
  not_started: "default",
  in_progress: "info",
  ready: "success",
  needs_attention: "warning",
};

function localDateKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function TripWorkspaceBrief({
  trip,
  trips,
  parks,
  payments,
  regionLabel,
  onSwitchTrip,
  onSaveFamilyName,
  onSaveAdventureName,
  onAdventureColorChange,
  showGoToToday,
  onGoToToday,
  isSaving,
  lastSavedAt,
  onOpenSmartPlan,
  onOpenDay,
}: Props) {
  const [todayKey, setTodayKey] = useState(localDateKey);
  const { checklistItems, budgetItems } = useTripWorkspaceData();

  useEffect(() => {
    setTodayKey(localDateKey());
  }, []);

  const checklist = useMemo(() => {
    if (!checklistItems) return null;
    return {
      total: checklistItems.length,
      checked: checklistItems.filter((item) => item.is_checked).length,
    };
  }, [checklistItems]);

  const parkById = useMemo(() => new Map(parks.map((p) => [p.id, p])), [parks]);
  const model = useMemo(() => {
    return buildTripWorkspaceModel({
      trip,
      parkById,
      payments,
      todayKey,
      checklist,
      budgetItems,
      tripHrefBase: `/trip/${trip.id}`,
    });
  }, [todayKey, budgetItems, trip, parkById, payments, checklist]);

  const phase = phaseCopy(trip, todayKey);
  const duration = Math.max(
    1,
    eachDateKeyInRange(trip.start_date, trip.end_date).length,
  );
  const prefsRecord =
    trip.preferences &&
    typeof trip.preferences === "object" &&
    !Array.isArray(trip.preferences)
      ? (trip.preferences as Record<string, unknown>)
      : null;

  const runAction = (action: WorkspaceAction) => {
    if (action.kind === "smart_plan") {
      onOpenSmartPlan();
      return;
    }
    if (action.kind === "open_day" && action.dateKey) {
      onOpenDay(action.dateKey);
      return;
    }
    if (action.kind === "focus_day" && action.dateKey) {
      const day = document.getElementById(`planner-day-${action.dateKey}`);
      const wide =
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 768px)").matches;
      if (wide && day) {
        day.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      onOpenDay(action.dateKey);
    }
  };

  return (
    <div className="space-y-3">
      <header className="rounded-tt-lg border border-tt-line bg-tt-surface px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge variant={phase.badge === "Past trip" ? "default" : "info"}>
                {phase.badge}
              </Badge>
              {phase.countdown ? (
                <span className="font-sans text-sm font-medium text-tt-royal">
                  {phase.countdown}
                </span>
              ) : null}
            </div>
            <h1 className="mt-1.5 text-balance font-heading text-xl font-semibold tracking-tight text-tt-royal sm:text-2xl">
              <EditableTitle
                key={`${trip.id}-fam`}
                value={trip.family_name}
                onSave={onSaveFamilyName}
                className="inline-block min-w-[4ch] text-tt-royal"
              />
              <span className="text-tt-royal/35"> — </span>
              <span className="inline-flex max-w-full flex-wrap items-baseline gap-1.5">
                <EditableTitle
                  key={`${trip.id}-adv`}
                  value={trip.adventure_name}
                  onSave={onSaveAdventureName}
                  className="inline-block min-w-[6ch]"
                  style={{ color: resolvedAdventureTitleColor(trip.preferences) }}
                />
                <AdventureTitleColorControl
                  preferences={prefsRecord}
                  onColorChange={onAdventureColorChange}
                />
              </span>
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-sans text-sm text-tt-ink-muted">
              <span>{regionLabel}</span>
              <span aria-hidden className="text-tt-line">
                ·
              </span>
              <span>{formatTripDateRange(trip.start_date, trip.end_date)}</span>
              <span aria-hidden className="text-tt-line">
                ·
              </span>
              <span>{`${duration} ${duration === 1 ? "day" : "days"}`}</span>
              <span aria-hidden className="text-tt-line">
                ·
              </span>
              <span>{partyLabel(trip)}</span>
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-xs lg:w-56">
            <label className="block font-sans text-xs font-medium text-tt-ink-muted">
              Switch trip
              <select
                value={trip.id}
                onChange={(e) => onSwitchTrip(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 text-sm font-semibold text-tt-royal focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-royal/40"
              >
                {trips.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.family_name} — {item.adventure_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {showGoToToday ? (
                <button
                  type="button"
                  onClick={onGoToToday}
                  className="inline-flex min-h-9 items-center rounded-full border border-tt-line px-3 font-sans text-xs font-semibold text-tt-royal transition hover:bg-tt-bg-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-royal/40"
                >
                  Go to today
                </button>
              ) : null}
              <SavingIndicator isSaving={isSaving} lastSavedAt={lastSavedAt} />
            </div>
          </div>
        </div>
      </header>

      <section
        aria-label="Planning overview"
        className="overflow-hidden rounded-tt-lg border border-tt-line bg-tt-surface"
      >
        <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.85fr)]">
          <div className="px-3 py-3 sm:px-4">
            <h2 className="font-heading text-sm font-semibold text-tt-royal">
              Where you are up to
            </h2>
            <ul className="mt-2 divide-y divide-tt-line-soft">
              {(model.areas).map((area) => (
                <li
                  key={area.id}
                  className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-medium text-tt-ink">
                      {area.label}
                    </p>
                    <p className="font-sans text-xs leading-relaxed text-tt-ink-muted">
                      {area.detail}
                    </p>
                  </div>
                  <Badge
                    variant={STATUS_VARIANT[area.status]}
                    className="mt-0.5 shrink-0 px-2 py-0.5"
                  >
                    {planningStatusLabel(area.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-tt-line-soft px-3 py-3 sm:px-4 lg:border-l lg:border-t-0">
            <h2 className="font-heading text-sm font-semibold text-tt-royal">
              Next actions
            </h2>
            {model.actions.length === 0 ? (
              <p className="mt-2 font-sans text-sm leading-relaxed text-tt-ink-muted">
                Nothing obvious is waiting. The calendar below is the holiday.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {model.actions.map((action) => (
                  <li key={action.id}>
                    {action.kind === "href" && action.href ? (
                      <Link
                        href={action.href}
                        className="block rounded-tt-md px-2 py-1.5 transition hover:bg-tt-bg-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-royal/40"
                      >
                        <ActionCopy action={action} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => runAction(action)}
                        className="block w-full rounded-tt-md px-2 py-1.5 text-left transition hover:bg-tt-bg-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-royal/40"
                      >
                        <ActionCopy action={action} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ActionCopy({ action }: { action: WorkspaceAction }) {
  return (
    <>
      <span className="block font-sans text-sm font-semibold text-tt-royal">
        {action.label}
      </span>
      <span className="block font-sans text-xs text-tt-ink-muted">{action.detail}</span>
    </>
  );
}
