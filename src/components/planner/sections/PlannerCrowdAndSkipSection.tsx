"use client";

import { CrowdStrategyBanner } from "@/components/planner/CrowdStrategyBanner";
import { SkipLineLegend } from "@/components/planner/SkipLineLegend";
import { resolvePlannerCrowdStrategyText } from "@/lib/planner/crowd-strategy-display-text";
import type { Park, Trip } from "@/lib/types";
import {
  regionHasDisneyQueueParks,
  regionHasUniversalQueueParks,
} from "@/lib/wizard-queue-step-region";
import { useMemo } from "react";

type Props = {
  showPlannerShell: boolean;
  activeTrip: Trip;
  parks: Park[];
  crowdSeasonPill: string | null;
};

export function PlannerCrowdAndSkipSection({
  showPlannerShell,
  activeTrip,
  parks,
  crowdSeasonPill,
}: Props) {
  const showSkipLineLegend = useMemo(
    () =>
      regionHasDisneyQueueParks(parks, activeTrip.region_id) ||
      regionHasUniversalQueueParks(parks, activeTrip.region_id),
    [parks, activeTrip.region_id],
  );

  const crowdBannerText = useMemo(
    () =>
      resolvePlannerCrowdStrategyText(
        activeTrip,
        parks,
        activeTrip.preferences?.ai_crowd_summary,
      ),
    [activeTrip, parks],
  );

  return (
    <>
      {showPlannerShell && crowdBannerText ? (
        <CrowdStrategyBanner
          text={crowdBannerText}
          seasonPill={crowdSeasonPill ?? undefined}
        />
      ) : null}

      {showPlannerShell && showSkipLineLegend ? (
        <div className="mt-3">
          <SkipLineLegend />
        </div>
      ) : null}
    </>
  );
}
