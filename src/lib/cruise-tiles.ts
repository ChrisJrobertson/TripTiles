/** Cruise / ship tiles that exist in multiple regions — hide from the drawer unless the trip includes a cruise. */

export const CRUISE_TILE_NAMES: readonly string[] = [
  "Cruise Embark",
  "Cruise Disembark",
  "Cruise — At Sea",
  "Cruise — Port Day",
  "Ship Day",
  "Ship Pool / Bar",
  "Ship Spa",
  "Shore Excursion",
  "Snorkel / Dive",
  "Port Shopping",
  "PortMiami Embark",
  "PortMiami Disembark",
] as const;

/** Normalise em/en dashes so hyphenated DB names still match. */
function cruiseNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ");
}

const CRUISE_SET = new Set<string>();
for (const n of CRUISE_TILE_NAMES) {
  CRUISE_SET.add(cruiseNameKey(n));
  CRUISE_SET.add(cruiseNameKey(n.replace(/[—–]/g, "-")));
}

export function isCruisePaletteTileName(name: string): boolean {
  return CRUISE_SET.has(cruiseNameKey(name));
}
