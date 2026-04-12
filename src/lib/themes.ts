import type { CSSProperties } from "react";

/**
 * Planner colour themes (per trip). Values apply to park tiles and accents —
 * not the planner page background (see `bg-cream` on the planner shell).
 * PDF export stays on brand defaults.
 */
export const THEME_KEYS = [
  "classic",
  "pastel",
  "sunset",
  "ocean",
  "garden",
  "berry",
] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export type ThemeDefinition = {
  name: string;
  /** User-facing label (UK copy). */
  label: string;
  /** Main park tile / slot fill. */
  tile: string;
  /** Borders, badges, secondary highlights. */
  accent: string;
  /** Outer tile border (may include alpha). */
  tileBorder: string;
  /** Selected rings, Smart Plan CTA background. */
  ring: string;
  /** Tile label text on pastel fills (dark). */
  tileText: string;
};

export const THEMES: Record<ThemeKey, ThemeDefinition> = {
  classic: {
    name: "Classic",
    label: "Classic",
    tile: "#D6DCE9",
    accent: "#C9A961",
    tileBorder: "rgba(11, 30, 92, 0.2)",
    ring: "#0B1E5C",
    tileText: "#1A1A2E",
  },
  pastel: {
    name: "Pastel Dream",
    label: "Pastel dream",
    tile: "#D8E2F0",
    accent: "#F2D5C4",
    tileBorder: "rgba(143, 163, 191, 0.3)",
    ring: "#8FA3BF",
    tileText: "#1A1A2E",
  },
  sunset: {
    name: "Sunset",
    label: "Sunset",
    tile: "#F5D6DC",
    accent: "#F9DFC8",
    tileBorder: "rgba(196, 146, 158, 0.3)",
    ring: "#C4929E",
    tileText: "#1A1A2E",
  },
  ocean: {
    name: "Ocean",
    label: "Ocean",
    tile: "#D0ECEF",
    accent: "#C8EDED",
    tileBorder: "rgba(127, 181, 191, 0.3)",
    ring: "#7FB5BF",
    tileText: "#1A1A2E",
  },
  garden: {
    name: "Garden",
    label: "Garden",
    tile: "#D6E8DC",
    accent: "#E4EFC8",
    tileBorder: "rgba(143, 181, 163, 0.3)",
    ring: "#8FB5A3",
    tileText: "#1A1A2E",
  },
  berry: {
    name: "Berry",
    label: "Berry",
    tile: "#EDD8E8",
    accent: "#F0D8EA",
    tileBorder: "rgba(184, 143, 173, 0.3)",
    ring: "#B88FAD",
    tileText: "#1A1A2E",
  },
} as const;

export function isThemeKey(v: string | null | undefined): v is ThemeKey {
  return v != null && (THEME_KEYS as readonly string[]).includes(v);
}

export function normaliseThemeKey(v: string | null | undefined): ThemeKey {
  return isThemeKey(v) ? v : "classic";
}

/** Inline style object for CSS variables consumed by the planner subtree. */
export function plannerThemeStyleVars(key: ThemeKey): CSSProperties {
  const t = THEMES[key];
  return {
    "--tt-tile": t.tile,
    "--tt-accent": t.accent,
    "--tt-tile-border": t.tileBorder,
    "--tt-ring": t.ring,
    "--tt-tile-text": t.tileText,
  } as CSSProperties;
}

const CATEGORY_STRIP_FALLBACK = "#C9A961";

/**
 * Themed catalogue / calendar tile: pastel tile body, full border, 4px
 * category strip (park or custom `bg_colour`) on the left.
 */
export function themedTileChromeStyle(
  categoryColour: string | null | undefined,
): CSSProperties {
  const strip =
    typeof categoryColour === "string" && categoryColour.startsWith("#")
      ? categoryColour
      : CATEGORY_STRIP_FALLBACK;
  return {
    backgroundColor: "var(--tt-tile)",
    color: "var(--tt-tile-text)",
    border: "1px solid var(--tt-tile-border)",
    borderLeft: `4px solid ${strip}`,
  } as CSSProperties;
}

/** Empty calendar / mobile slot background: ~10% theme tint on white. */
export function themedEmptySlotSurfaceStyle(): CSSProperties {
  return {
    backgroundColor: "color-mix(in srgb, var(--tt-tile) 10%, #ffffff)",
  } as CSSProperties;
}
