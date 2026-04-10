"use client";

import { FirstRunChecklist } from "@/components/planner/FirstRunChecklist";
import { PurchaseHelpBanner } from "@/components/planner/PurchaseHelpBanner";

type Props = {
  purchaseHighlight: boolean;
  hasTrip: boolean;
  hasAnyAssignment: boolean;
};

/**
 * Single visual block for purchase help + onboarding so the planner doesn’t
 * stack two heavy banners.
 */
export function PlannerTopNotices({
  purchaseHighlight,
  hasTrip,
  hasAnyAssignment,
}: Props) {
  return (
    <div className="mb-3 flex flex-col gap-2">
      <PurchaseHelpBanner highlight={purchaseHighlight} embedded />
      <FirstRunChecklist
        hasTrip={hasTrip}
        hasAnyAssignment={hasAnyAssignment}
        embedded
      />
    </div>
  );
}
