"use client";

import {
  CROWD_LEVEL_META,
  type CrowdLevel,
} from "@/lib/planner-crowd-level-meta";

export type DayHeatSidecarProps = {
  tempC: number;
  crowdLevel: CrowdLevel;
};

/**
 * Simple heat advice from temperature; crowd label for context (no AI). UK copy.
 */
export function DayHeatSidecar({ tempC, crowdLevel }: DayHeatSidecarProps) {
  const n = Math.round(tempC);
  const advice =
    n >= 30
      ? `${n}°C peak. 2L water per person, sunscreen reapply mid-afternoon, hats for the kids.`
      : n >= 22
        ? `${n}°C. Pack water and sunscreen — plan a shaded break around 14:00.`
        : `${n}°C — comfortable. A light layer for evening is sensible.`;

  return (
    <aside
      className="rounded-lg border-[0.5px] border-royal/15 bg-white/95 p-3.5 shadow-sm dark:border-white/10 dark:bg-neutral-900/30"
      aria-label="Heat plan"
    >
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.5px] text-royal/60 dark:text-neutral-200/80">
        Heat plan
      </p>
      <p className="mt-1.5 font-sans text-sm leading-snug text-royal/85 dark:text-neutral-200">
        {advice}
      </p>
      <p className="mt-2 font-sans text-xs text-royal/55 dark:text-neutral-300/80">
        Typical day: {CROWD_LEVEL_META[crowdLevel].label.toLowerCase()} crowds.
      </p>
    </aside>
  );
}
