"use client";

import { PlanningSections } from "@/components/planner/PlanningSections";
import type { Park, Trip } from "@/lib/types";
import type { TripPayment } from "@/types/payments";

type Props = {
  trip: Trip;
  payments: TripPayment[];
  onPaymentsChange: (tripId: string, next: TripPayment[]) => void;
  onTripPatch: (patch: Partial<Trip>) => void;
  regionLabelForKeyDates: string;
  regionCountryCode?: string | null;
  initialSection: "todo" | "payments" | "budget" | null;
  parks: Park[];
  onEditTrip: () => void;
  hasAnyAssignment: boolean;
};

export function PlannerPlanningTabPanel({
  trip,
  payments,
  onPaymentsChange,
  onTripPatch,
  regionLabelForKeyDates,
  regionCountryCode = null,
  initialSection,
  parks,
  onEditTrip,
  hasAnyAssignment,
}: Props) {
  return (
    <PlanningSections
      trip={trip}
      payments={payments}
      onPaymentsChange={onPaymentsChange}
      onTripPatch={onTripPatch}
      regionLabelForKeyDates={regionLabelForKeyDates}
      regionCountryCode={regionCountryCode}
      initialSection={initialSection}
      parks={parks}
      onEditTrip={onEditTrip}
      hasAnyAssignment={hasAnyAssignment}
    />
  );
}
