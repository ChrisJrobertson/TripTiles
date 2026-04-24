/** Stored under `trips.preferences`. `null` or omitted = default royal. */
export const ADVENTURE_TITLE_COLOR_KEY = "adventure_title_color";

/** Matches `--color-royal` / `text-royal`. */
export const DEFAULT_ADVENTURE_TITLE_COLOR = "#2455ac";

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX3 = /^#[0-9a-fA-F]{3}$/;

/** Returns normalized `#rrggbb` or `null` if the value is not a valid custom color. */
export function normalizeAdventureTitleColor(
  value: unknown,
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  if (HEX6.test(s)) return s.toLowerCase();
  if (HEX3.test(s)) {
    const r = s[1]!;
    const g = s[2]!;
    const b = s[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export function resolvedAdventureTitleColor(
  preferences: Record<string, unknown> | null | undefined,
): string {
  return (
    normalizeAdventureTitleColor(
      preferences?.[ADVENTURE_TITLE_COLOR_KEY],
    ) ?? DEFAULT_ADVENTURE_TITLE_COLOR
  );
}
