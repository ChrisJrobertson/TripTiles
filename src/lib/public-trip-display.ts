import type { Trip } from "@/lib/types";

/** Stored on `trips.preferences.public_view` — shown only on public /plans pages. */
export type PublicViewPrefs = {
  family_label?: string;
  /** Optional override; falls back to `adventure_name` if unset. */
  adventure_title?: string;
};

function parsePublicView(
  preferences: unknown,
): PublicViewPrefs | null {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    return null;
  }
  const root = preferences as Record<string, unknown>;
  const raw = root.public_view;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: PublicViewPrefs = {};
  if (typeof o.family_label === "string") out.family_label = o.family_label;
  if (typeof o.adventure_title === "string") {
    out.adventure_title = o.adventure_title;
  }
  return out;
}

/** Line under dates on /plans/[slug] — never uses private `family_name`. */
/** For Share panel initial values (raw overrides only). */
export function getPublicViewFormValues(
  trip: Pick<Trip, "preferences">,
): { familyLabel: string; adventureTitle: string } {
  const pv = parsePublicView(trip.preferences);
  return {
    familyLabel: pv?.family_label?.trim() ?? "",
    adventureTitle: pv?.adventure_title?.trim() ?? "",
  };
}

export function getPublicFamilyLine(trip: Trip): string {
  const pv = parsePublicView(trip.preferences);
  const custom = pv?.family_label?.trim();
  if (custom) return custom;
  return "Travelling party";
}

/**
 * Title in public header, OG, and metadata. Uses optional override, else trip name.
 */
export function getPublicAdventureTitle(trip: Trip): string {
  const pv = parsePublicView(trip.preferences);
  const custom = pv?.adventure_title?.trim();
  if (custom) return custom;
  return trip.adventure_name.trim() || "Trip plan";
}

export function getPublicAdventureTitleFromRow(
  row: Record<string, unknown>,
): string {
  const defaultName = String(row.adventure_name ?? "Trip plan");
  return getPublicAdventureTitleFromPreferences(row.preferences, defaultName);
}

function getPublicAdventureTitleFromPreferences(
  preferences: unknown,
  defaultName: string,
): string {
  const pv = parsePublicView(
    preferences && typeof preferences === "object" && !Array.isArray(preferences)
      ? preferences
      : {},
  );
  const custom = pv?.adventure_title?.trim();
  if (custom) return custom;
  return defaultName.trim() || "Trip plan";
}
