"use client";

import { Calendar } from "@/components/planner/Calendar";
import { MobileDayView } from "@/components/planner/MobileDayView";
import {
  plannerAiDayCrowdNotes,
  plannerUserDayNotes,
} from "@/lib/planner-note-maps";
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
  const crowd =
    typeof trip.preferences?.ai_crowd_summary === "string" &&
    trip.preferences.ai_crowd_summary.trim()
      ? trip.preferences.ai_crowd_summary.trim()
      : null;

  return (
    <>
      <div className="hidden md:block">
        <Calendar
          trip={trip}
          parks={parks}
          selectedParkId={null}
          readOnly
          onAssign={() => {}}
          onClear={() => {}}
          onNeedParkFirst={() => {}}
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
        onMenuShare={() => {
          void navigator.clipboard?.writeText(shareUrl);
        }}
      />
    </>
  );
}
