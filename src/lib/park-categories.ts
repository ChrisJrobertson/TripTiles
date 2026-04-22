import { GROUP_ORDER } from "@/lib/group-meta";

/**
 * Park groups that represent theme parks or major ride-based attractions
 * (catalogue + must-do UI applies). Aligned with `MAIN_PARK_GROUPS` in
 * `ai-plan-guardrails.ts` and `THEME_GROUPS` in `compute-trip-stats.ts`.
 */
export const THEME_PARK_GROUPS: ReadonlyArray<string> = [
  "disney",
  "disneyextra",
  "universal",
  "seaworld",
  "attractions",
];

export const THEME_PARK_GROUP_SET = new Set(THEME_PARK_GROUPS);

const NON_PARK_GROUP_SET: ReadonlySet<string> = new Set(
  GROUP_ORDER.filter((g) => !THEME_PARK_GROUP_SET.has(g)),
);

export const NON_PARK_GROUPS: ReadonlyArray<string> = [
  ...NON_PARK_GROUP_SET,
];

export type ParkGroupClass = "theme" | "non_theme" | "unknown";

/**
 * travel, dining, activities, city sights, cruise excursions — no ride must-do
 * list in the app sense. Unknown groups are treated as non-theme (conservative).
 */
export function classifyParkGroup(
  parkGroup: string | null | undefined,
): ParkGroupClass {
  if (!parkGroup || !String(parkGroup).trim()) return "non_theme";
  const g = String(parkGroup).trim();
  if (THEME_PARK_GROUP_SET.has(g)) return "theme";
  if (NON_PARK_GROUP_SET.has(g)) return "non_theme";
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    console.warn(
      `[park-categories] Unrecognised park_group "${g}" — treating as non-theme. Add to GROUP_ORDER / park-categories if this is a new category.`,
    );
  }
  return "unknown";
}

export function isThemePark(parkGroup: string | null | undefined): boolean {
  return classifyParkGroup(parkGroup) === "theme";
}
