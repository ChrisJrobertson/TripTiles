"use client";

import { CountdownChip } from "@/components/planning/CountdownChip";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Trip } from "@/lib/types";
import { useMemo } from "react";

type KeyDateRow = {
  id: string;
  icon: string;
  label: string;
  dateKey: string;
  notes?: string;
};

export type PlannerKeyDateRow = KeyDateRow;

/** Region slugs that imply a US visit (ESTA / travel authorisation). */
const US_ESTA_REGION_IDS = new Set([
  "orlando",
  "cali",
  "florida_combo",
  "miami",
  "lasvegas",
]);

function shiftDateKey(dateKey: string, deltaDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function buildRows(trip: Trip): KeyDateRow[] {
  const { start_date, end_date, has_cruise, cruise_embark, cruise_disembark, region_id } =
    trip;
  const rows: KeyDateRow[] = [];

  const diningOpen = shiftDateKey(start_date, -60);
  if (diningOpen) {
    rows.push({
      id: "dining-60",
      icon: "🍽️",
      label: "Disney dining reservations open",
      dateKey: diningOpen,
      notes:
        "Table-service restaurants book up fast — set a reminder for 6am.",
    });
  }

  rows.push({
    id: "ll",
    icon: "⚡",
    label: "Disney Lightning Lane",
    dateKey: start_date,
    notes:
      "Book at 7am on each park morning via the My Disney Experience app.",
  });

  const universal = shiftDateKey(start_date, -14);
  if (universal) {
    rows.push({
      id: "universal-express",
      icon: "🎢",
      label: "Universal Express Pass",
      dateKey: universal,
      notes: "Book ahead for peak season to guarantee availability.",
    });
  }

  if (has_cruise && cruise_embark && /^\d{4}-\d{2}-\d{2}$/.test(cruise_embark)) {
    const p75 = shiftDateKey(cruise_embark, -75);
    if (p75) {
      rows.push({
        id: "cruise-port",
        icon: "🚢",
        label: "Disney Cruise port adventures",
        dateKey: p75,
        notes: "Port adventures release by sailing — check your Castaway Club window.",
      });
      rows.push({
        id: "cruise-adult-dining",
        icon: "🍷",
        label: "Disney Cruise adult dining",
        dateKey: p75,
        notes: "Palo, Enchante, and Remy book early for popular nights.",
      });
    }
  }

  const region = region_id ?? "";
  if (US_ESTA_REGION_IDS.has(region)) {
    const esta = shiftDateKey(start_date, -14);
    if (esta) {
      rows.push({
        id: "esta",
        icon: "🛂",
        label: "ESTA / travel authorisation",
        dateKey: esta,
        notes:
          "Apply at esta.cbp.dhs.gov — allow 72hrs minimum, ideally weeks ahead.",
      });
    }
  }

  rows.push({
    id: "depart",
    icon: "✈️",
    label: "Departure",
    dateKey: start_date,
  });

  rows.push({
    id: "return",
    icon: "🏠",
    label: "Return home",
    dateKey: end_date,
  });

  if (has_cruise && cruise_embark && /^\d{4}-\d{2}-\d{2}$/.test(cruise_embark)) {
    rows.push({
      id: "cruise-emb",
      icon: "🚢",
      label: "Cruise embarkation",
      dateKey: cruise_embark,
    });
  }
  if (has_cruise && cruise_disembark && /^\d{4}-\d{2}-\d{2}$/.test(cruise_disembark)) {
    rows.push({
      id: "cruise-dis",
      icon: "🚢",
      label: "Cruise disembarkation",
      dateKey: cruise_disembark,
    });
  }

  return rows.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.dateKey));
}

export function buildPlannerKeyDateRowsSorted(trip: Trip): KeyDateRow[] {
  const list = buildRows(trip);
  return [...list].sort((a, b) => {
    if (a.dateKey < b.dateKey) return -1;
    if (a.dateKey > b.dateKey) return 1;
    return a.id.localeCompare(b.id);
  });
}

type Props = {
  trip: Trip;
  className?: string;
  /** Render only the milestone list (no Card or SectionHeader). */
  listOnly?: boolean;
};

export function KeyDatesPanel({
  trip,
  className = "",
  listOnly = false,
}: Props) {
  const rows = useMemo(() => {
    return buildPlannerKeyDateRowsSorted(trip);
  }, [trip]);

  if (listOnly) {
    return (
      <ul className={`space-y-3 ${className}`.trim()}>
        {rows.map((row) => (
          <li
            key={`${row.id}-${row.dateKey}`}
            className="rounded-tt-lg border border-tt-line bg-tt-surface px-3 py-3 shadow-tt-sm sm:px-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="text-lg leading-none" aria-hidden>
                    {row.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-semibold text-tt-ink">
                      {row.label}
                    </p>
                    {row.notes ? (
                      <p className="mt-1 font-sans text-xs italic leading-snug text-tt-ink-soft">
                        {row.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <CountdownChip
                  targetDate={row.dateKey}
                  label={`${row.label}: ${row.dateKey}`}
                  treatPastAsMilestone
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card
      as="section"
      variant="subtle"
      className={`p-4 backdrop-blur-md sm:p-5 ${className}`}
      aria-labelledby="key-dates-heading"
    >
      <SectionHeader
        title="Key dates & booking windows"
        subtitle="Important dates to put in your calendar before you travel."
        icon="📅"
      />
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li
            key={`${row.id}-${row.dateKey}`}
            className="rounded-tt-lg border border-tt-line bg-tt-surface px-3 py-3 shadow-tt-sm sm:px-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-2">
                  <span className="text-lg leading-none" aria-hidden>
                    {row.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-semibold text-tt-ink">
                      {row.label}
                    </p>
                    {row.notes ? (
                      <p className="mt-1 font-sans text-xs italic leading-snug text-tt-ink-soft">
                        {row.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                <CountdownChip
                  targetDate={row.dateKey}
                  label={`${row.label}: ${row.dateKey}`}
                  treatPastAsMilestone
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
