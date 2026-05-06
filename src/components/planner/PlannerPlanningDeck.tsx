"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PaymentsTab } from "@/components/planner/PaymentsTab";
import { TripChecklistView } from "@/components/planner/TripChecklistView";
import { KeyDatesPanel } from "@/components/planning/KeyDatesPanel";
import type { Trip } from "@/lib/types";
import type { TripPayment } from "@/types/payments";


type Props = {
  trip: Trip;
  payments: TripPayment[];
  onPaymentsChange: (tripId: string, next: TripPayment[]) => void;
};

/**
 * Payments, checklist, and key dates surfaced on /planner (same data/actions as Planning tab).
 */
export function PlannerPlanningDeck({
  trip,
  payments,
  onPaymentsChange,
}: Props) {
  return (
    <div className="mt-8 grid gap-5 xl:grid-cols-3">
      <Card variant="elevated" className="flex flex-col overflow-hidden p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-tt-line-soft pb-3">
          <SectionHeader
            title="Payments schedule"
            subtitle="Track deposits, balances, flights and tickets"
            icon="💷"
            className="min-w-0"
          />
        </div>
        <PaymentsTab
          trip={trip}
          payments={payments}
          onPaymentsChange={onPaymentsChange}
          embedded
          showTitleRow={false}
        />
      </Card>

      <Card variant="elevated" className="flex flex-col overflow-hidden p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-tt-line-soft pb-3">
          <SectionHeader
            title="To-do list"
            subtitle="Prep, packing, and day-of"
            icon="✓"
            className="min-w-0"
          />
          <Link
            href={`/trip/${trip.id}?tab=checklist`}
            className="font-meta text-[11px] font-semibold uppercase tracking-wide text-tt-royal underline decoration-tt-line underline-offset-2"
          >
            Open full list
          </Link>
        </div>
        <div className="pt-4">
          <TripChecklistView trip={trip} embedded />
        </div>
      </Card>

      <Card variant="elevated" className="flex flex-col overflow-hidden p-4 sm:p-5 xl:col-span-1">
        <div className="border-b border-tt-line-soft pb-3">
          <SectionHeader
            title="Key dates & booking windows"
            subtitle="Important dates before you travel"
            icon="📅"
          />
        </div>
        <div className="pt-4">
          <KeyDatesPanel trip={trip} listOnly />
        </div>
        <Link
          href={`/trip/${trip.id}?tab=payments`}
          className="mt-4 inline-flex min-h-9 items-center font-meta text-[11px] font-semibold uppercase tracking-wide text-tt-royal underline decoration-tt-line underline-offset-4 hover:text-tt-royal-deep"
        >
          View on Organise tab →
        </Link>
      </Card>
    </div>
  );
}
