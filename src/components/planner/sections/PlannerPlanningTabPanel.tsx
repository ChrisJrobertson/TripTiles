"use client";

import { PlanningSections } from "@/components/planner/PlanningSections";
import type { Trip } from "@/lib/types";
import type { TripPayment } from "@/types/payments";

type Props = {
  trip: Trip;
  payments: TripPayment[];
  onPaymentsChange: (tripId: string, next: TripPayment[]) => void;
  onTripPatch: (patch: Partial<Trip>) => void;
  initialSection: "todo" | "payments" | "budget" | null;
};

export function PlannerPlanningTabPanel({
  trip,
  payments,
  onPaymentsChange,
  onTripPatch,
  initialSection,
}: Props) {
  return (
    <PlanningSections
      trip={trip}
      payments={payments}
      onPaymentsChange={onPaymentsChange}
      onTripPatch={onTripPatch}
      initialSection={initialSection}
    />
  );
}
