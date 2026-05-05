import type { DayPlanningIntent, TripPlanningPreferences } from "@/lib/types";

/** Field keys returned by `generateDayStrategy` when `status === 'missing_data'`. */
export const DAY_STRATEGY_FIELD = {
  dayIntent: "dayIntent",
  parkAction: "parkAction",
  dayType: "dayType",
  rideLevel: "rideLevel",
  mealPreference: "mealPreference",
  pace: "pace",
  startPreference: "startPreference",
  finishPreference: "finishPreference",
  paidAccess: "paidAccess",
  changePermission: "changePermission",
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
  dayIntent?: DayPlanningIntent | null,
): DayStrategyMissingField[] {
  const missing: DayStrategyMissingField[] = [];
  const children = prefs?.children ?? 0;

  if (!dayIntent) {
    missing.push(DAY_STRATEGY_FIELD.dayIntent);
  } else {
    if (!dayIntent.parkAction) missing.push(DAY_STRATEGY_FIELD.parkAction);
    if (!dayIntent.dayType) missing.push(DAY_STRATEGY_FIELD.dayType);
    if (!dayIntent.rideLevel) missing.push(DAY_STRATEGY_FIELD.rideLevel);
    if (!dayIntent.mealPreference) missing.push(DAY_STRATEGY_FIELD.mealPreference);
    if (!dayIntent.pace) missing.push(DAY_STRATEGY_FIELD.pace);
    if (!dayIntent.startPreference) missing.push(DAY_STRATEGY_FIELD.startPreference);
    if (!dayIntent.finishPreference)
      missing.push(DAY_STRATEGY_FIELD.finishPreference);
    if (!dayIntent.paidAccess) missing.push(DAY_STRATEGY_FIELD.paidAccess);
    if (!dayIntent.changePermission)
      missing.push(DAY_STRATEGY_FIELD.changePermission);
  }

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
