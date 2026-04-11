export type CrowdLevel = "quiet" | "moderate" | "busy";

export type HeuristicCrowdTone = "low" | "mid" | "high";

export const CROWD_LEVEL_META: Record<
  CrowdLevel,
  { colour: string; label: string; symbol: string; ariaLabel: string }
> = {
  quiet: {
    colour: "#22c55e",
    label: "Quiet",
    symbol: "●",
    ariaLabel: "Crowd level: quiet",
  },
  moderate: {
    colour: "#eab308",
    label: "Moderate",
    symbol: "◐",
    ariaLabel: "Crowd level: moderate",
  },
  busy: {
    colour: "#ef4444",
    label: "Busy",
    symbol: "▲",
    ariaLabel: "Crowd level: busy",
  },
};

export function crowdLevelFromHeuristicTone(
  tone: HeuristicCrowdTone,
): CrowdLevel {
  if (tone === "low") return "quiet";
  if (tone === "high") return "busy";
  return "moderate";
}

export function crowdPdfSymbolForTone(tone: HeuristicCrowdTone): {
  symbol: string;
  color: string;
  ariaLabel: string;
} {
  const level = crowdLevelFromHeuristicTone(tone);
  const m = CROWD_LEVEL_META[level];
  return { symbol: m.symbol, color: m.colour, ariaLabel: m.ariaLabel };
}

/** Same keyword rules as planner Calendar (day-note text → tone). */
export function heuristicCrowdToneFromNoteText(
  note: string | null,
): HeuristicCrowdTone | null {
  if (!note) return null;
  const t = note.toLowerCase();
  if (
    /\b(quiet|calm|lighter|lowest|easiest|emptier|low crowds?|lighter crowds?)\b/.test(
      t,
    )
  ) {
    return "low";
  }
  if (
    /\b(busy|heavy|peak|worst|packed|crowded|high crowds?|busier)\b/.test(t)
  ) {
    return "high";
  }
  return "mid";
}
