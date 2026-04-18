"use client";

import { FirstRunChecklist } from "@/components/planner/FirstRunChecklist";

type Props = {
  hasTrip: boolean;
  hasAnyAssignment: boolean;
};

/**
 * Onboarding checklist for the planner shell.
 */
export function PlannerTopNotices({ hasTrip, hasAnyAssignment }: Props) {
  return (
    <div className="mb-3 flex flex-col gap-2">
      <FirstRunChecklist
        hasTrip={hasTrip}
        hasAnyAssignment={hasAnyAssignment}
        embedded
      />
    </div>
  );
}
