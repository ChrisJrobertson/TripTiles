"use client";

import { Calendar } from "@/components/planner/Calendar";
import { MobileDayView } from "@/components/planner/MobileDayView";
import {
  plannerAiDayCrowdNotes,
  plannerUserDayNotes,
} from "@/lib/planner-note-maps";
import { copyTextToClipboard } from "@/lib/clipboard-access";
import { sanitizeAiPlannerDisplayText } from "@/lib/ai-sanitize-notes";
import { resolvePlannerCrowdStrategyText } from "@/lib/planner/crowd-strategy-display-text";
import { normaliseThemeKey, plannerThemeStyleVars } from "@/lib/themes";
import type { Park, Trip } from "@/lib/types";
import { useMemo } from "react";

type Props = {
  trip: Trip;
  parks: Park[];
  shareUrl: string;
};

export function PublicPlanPlannerShell({ trip, parks, shareUrl }: Props) {
  const ai = useMemo(() => plannerAiDayCrowdNotes(trip), [trip]);
  const user = useMemo(() => plannerUserDayNotes(trip), [trip]);
  const crowd = useMemo(() => {
    const resolved = resolvePlannerCrowdStrategyText(
      trip,
      parks,
      trip.preferences?.ai_crowd_summary,
    );
    return resolved ? sanitizeAiPlannerDisplayText(resolved.trim()) : null;
  }, [trip, parks]);

  const themeShellStyle = useMemo(
    () => plannerThemeStyleVars(normaliseThemeKey(trip.colour_theme)),
    [trip.colour_theme],
  );

  return (
    <div style={themeShellStyle}>
      <div className="hidden md:block">
        <Calendar
          trip={trip}
          parks={parks}
          selectedParkId={null}
          readOnly
          onAssign={() => {}}
          onClear={() => {}}
          onNeedParkFirst={() => {}}
          plannerRegionId={trip.region_id}
          temperatureUnit="c"
        />
      </div>
      <MobileDayView
        trip={trip}
        parks={parks}
        assignments={trip.assignments ?? {}}
        dayNotes={ai}
        userDayNotes={user}
        onAssign={() => {}}
        onClear={() => {}}
        crowdSummary={crowd}
        readOnly
        plannerRegionId={trip.region_id}
        temperatureUnit="c"
        onMenuShare={() => {
          void copyTextToClipboard(shareUrl);
        }}
      />
    </div>
  );
}
