"use client";

import { useTripWorkspaceData } from "@/components/planner/state/TripWorkspaceData";
import { Badge } from "@/components/ui/Badge";
import type { Park, Trip } from "@/lib/types";
import {
  buildTripWorkspaceModel,
  organiseTone,
  organiseToneLabel,
  type OrganiseTone,
  type WorkspaceAreaId,
} from "@/lib/trip-workspace-status";
import type { TripPayment } from "@/types/payments";
import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  trip: Trip;
  payments: TripPayment[];
  parks: Park[];
};

const TONE_VARIANT: Record<OrganiseTone, "default" | "info" | "success" | "warning"> = {
  complete: "success",
  in_progress: "info",
  needs_attention: "warning",
  optional: "default",
};

const HREF: Partial<Record<WorkspaceAreaId, string>> = {
  accommodation: "planning#organise-accommodation",
  preferences: "planning#organise-preferences",
  checklist: "checklist",
  budget: "budget",
};

const WHEN_EMPTY: Partial<Record<WorkspaceAreaId, "needs_attention" | "optional">> = {
  accommodation: "needs_attention",
  preferences: "needs_attention",
  checklist: "needs_attention",
  budget: "optional",
};

function localDateKey(d = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function PlannerPlanningDeck({ trip, payments, parks }: Props) {
  const { checklistItems, budgetItems } = useTripWorkspaceData();
  const [todayKey] = useState(localDateKey);
  const parkById = useMemo(() => new Map(parks.map((park) => [park.id, park])), [parks]);
  const checklist = useMemo(() => {
    if (!checklistItems) return null;
    return {
      total: checklistItems.length,
      checked: checklistItems.filter((item) => item.is_checked).length,
    };
  }, [checklistItems]);
  const model = useMemo(
    () =>
      buildTripWorkspaceModel({
        trip,
        parkById,
        payments,
        todayKey,
        checklist,
        budgetItems,
        tripHrefBase: `/trip/${trip.id}`,
      }),
    [budgetItems, checklist, parkById, payments, todayKey, trip],
  );

  const rows = (["accommodation", "preferences", "checklist", "budget"] as const)
    .map((id) => model.areas.find((area) => area.id === id))
    .filter((area): area is NonNullable<typeof area> => Boolean(area));

  return (
    <section
      aria-label="Holiday setup"
      className="rounded-tt-lg border border-tt-line bg-tt-surface px-3 py-3 sm:px-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-tt-royal">
            Get this holiday ready
          </h2>
          <p className="mt-1 font-sans text-sm text-tt-ink-muted">
            Stay, preferences, checklist, and budget live in Organise.
          </p>
        </div>
        <Link
          href={`/trip/${trip.id}?tab=planning`}
          className="inline-flex min-h-11 shrink-0 items-center font-sans text-sm font-semibold text-tt-royal underline decoration-tt-line underline-offset-4"
        >
          Open Organise
        </Link>
      </div>
      {rows.length > 0 ? (
        <ul className="mt-2 divide-y divide-tt-line-soft">
          {rows.map((area) => {
            const tone = organiseTone(area.status, WHEN_EMPTY[area.id] ?? "optional");
            const tab = HREF[area.id] ?? "planning";
            return (
              <li key={area.id}>
                <Link
                  href={`/trip/${trip.id}?tab=${tab}`}
                  className="flex items-start justify-between gap-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-royal/40"
                >
                  <span className="min-w-0">
                    <span className="block font-sans text-sm font-medium text-tt-ink">
                      {area.label}
                    </span>
                    <span className="block font-sans text-xs text-tt-ink-muted">{area.detail}</span>
                  </span>
                  <Badge variant={TONE_VARIANT[tone]} className="mt-0.5 shrink-0 px-2 py-0.5">
                    {organiseToneLabel(tone)}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
