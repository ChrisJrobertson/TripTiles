import type { TripPlanningPreferences } from "@/lib/types";

const PACE_COPY: Record<TripPlanningPreferences["pace"], string> = {
  relaxed:
    "Relaxed pace — pool mornings, one headline park per day where possible, early wind-downs.",
  balanced:
    "Balanced pace — a sensible mix of park days and downtime.",
  intense:
    "High energy — maximise park time; family accepts longer days.",
};

const PRIORITY_LABELS: Record<string, string> = {
  thrill_rides: "Thrill rides",
  toddler_friendly: "Toddler-friendly",
  dining: "Great dining",
  shows: "Shows & entertainment",
  water: "Water parks & pools",
  characters: "Character meet & greets",
  shopping: "Shopping & downtime",
  evenings: "Evening events & fireworks",
};

/** Extra user-message block for Claude from structured wizard answers. */
export function formatPlanningPreferencesForPrompt(
  prefs: TripPlanningPreferences,
  parkIdToName: Map<string, string>,
): string {
  const mustNames = prefs.mustDoParks
    .map((id) => parkIdToName.get(id) ?? id)
    .filter(Boolean);
  const priLabels = prefs.priorities
    .map((k) => PRIORITY_LABELS[k] ?? k)
    .filter(Boolean);
  const ages =
    prefs.childAges.length > 0
      ? `Children ages (years): ${prefs.childAges.join(", ")}.`
      : "";
  const notes = prefs.additionalNotes?.trim()
    ? `Additional family notes:\n${prefs.additionalNotes.trim()}`
    : "";

  const disneyTips = prefs.includeDisneySkipTips !== false;
  const universalTips = prefs.includeUniversalSkipTips !== false;
  const skipLineBlock =
    disneyTips && universalTips
      ? ""
      : [
          "SKIP_THE_LINE_PRODUCTS (written tips and planner_day_notes only — never invent purchases):",
          disneyTips
            ? "- Disney Lightning Lane / Genie+ / Multi Pass style tactics: include when relevant."
            : "- Disney Lightning Lane / Genie+ / Multi Pass: the guest does NOT want these products assumed — omit LL-specific booking tactics; use general rope-drop / queue patience advice only.",
          universalTips
            ? "- Universal Express-style tactics: include when relevant."
            : "- Universal Express: omit Express-specific queue tactics; use general advice only.",
        ].join("\n");

  return [
    "TRIP WIZARD PREFERENCES (treat as hard requirements where compatible with park rules):",
    `- Party: ${prefs.adults} adult(s), ${prefs.children} child(ren). ${ages}`.trim(),
    `- Pace: ${PACE_COPY[prefs.pace]}`,
    mustNames.length
      ? `- Must-include venues (use these on suitable days): ${mustNames.join("; ")}.`
      : "- Must-include venues: no specific list — use crowd logic.",
    priLabels.length
      ? `- Family priorities (weight these): ${priLabels.join("; ")}.`
      : "",
    notes,
    skipLineBlock,
  ]
    .filter(Boolean)
    .join("\n");
}
