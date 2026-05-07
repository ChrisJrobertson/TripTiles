"use client";

import { CrowdStrategyBanner } from "@/components/planner/CrowdStrategyBanner";
import { SkipLineLegend } from "@/components/planner/SkipLineLegend";
import type { Trip } from "@/lib/types";

type Props = {
  showPlannerShell: boolean;
  activeTrip: Trip;
  crowdSeasonPill: string | null;
};

export function PlannerCrowdAndSkipSection({
  showPlannerShell,
  activeTrip,
  crowdSeasonPill,
}: Props) {
  return (
    <>
      {showPlannerShell &&
      typeof activeTrip.preferences?.ai_crowd_summary === "string" &&
      (activeTrip.preferences.ai_crowd_summary as string).trim() ? (
        <CrowdStrategyBanner
          text={(activeTrip.preferences.ai_crowd_summary as string).trim()}
          seasonPill={crowdSeasonPill ?? undefined}
        />
      ) : null}

      {showPlannerShell ? (
        <div className="mt-3">
          <SkipLineLegend />
        </div>
      ) : null}
    </>
  );
}
