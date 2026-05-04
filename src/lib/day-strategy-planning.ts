import type { TripPlanningPreferences } from "@/lib/types";

/** Field keys returned by `generateDayStrategy` when `status === 'missing_data'`. */
export const DAY_STRATEGY_FIELD = {
  childHeights: "childHeights",
  mobility: "mobility",
  disneyLightningLane: "disneyLightningLane",
  universalExpress: "universalExpress",
} as const;

export type DayStrategyMissingField =
  (typeof DAY_STRATEGY_FIELD)[keyof typeof DAY_STRATEGY_FIELD];

export function missingDayStrategyPlanningFields(
  prefs: TripPlanningPreferences | null | undefined,
  line: "disney" | "universal" | "other",
): DayStrategyMissingField[] {
  const missing: DayStrategyMissingField[] = [];
  const children = prefs?.children ?? 0;

  if (children > 0) {
    const ch = prefs?.childHeights ?? [];
    if (
      ch.length < children ||
      ch.some((h) => !h || typeof h.heightCm !== "number")
    ) {
      missing.push(DAY_STRATEGY_FIELD.childHeights);
    }
  }

  if (prefs?.mobility == null) {
    missing.push(DAY_STRATEGY_FIELD.mobility);
  }

  if (line === "disney" && !prefs?.disneyLightningLane) {
    missing.push(DAY_STRATEGY_FIELD.disneyLightningLane);
  }
  if (line === "universal" && !prefs?.universalExpress) {
    missing.push(DAY_STRATEGY_FIELD.universalExpress);
  }

  return missing;
}
