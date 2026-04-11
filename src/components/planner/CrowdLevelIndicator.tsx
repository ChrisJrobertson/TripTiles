"use client";

import {
  type CrowdLevel,
  CROWD_LEVEL_META,
} from "@/lib/planner-crowd-level-meta";

export type { CrowdLevel, HeuristicCrowdTone } from "@/lib/planner-crowd-level-meta";
export { crowdLevelFromHeuristicTone } from "@/lib/planner-crowd-level-meta";

type Props = {
  level: CrowdLevel | null;
  size?: "sm" | "md";
  showLabel?: boolean;
};

export function CrowdLevelIndicator({
  level,
  size = "sm",
  showLabel = false,
}: Props) {
  if (!level) return null;
  const meta = CROWD_LEVEL_META[level];
  const sizeClass = size === "sm" ? "text-sm" : "text-base";

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeClass}`}
      aria-label={meta.ariaLabel}
      title={meta.ariaLabel}
    >
      <span
        className="font-bold leading-none"
        style={{ color: meta.colour }}
        aria-hidden="true"
      >
        {meta.symbol}
      </span>
      {showLabel ? (
        <span className="text-xs text-royal/70">{meta.label}</span>
      ) : null}
    </span>
  );
}
