import type { CSSProperties } from "react";

/**
 * Planner themes: UI accent for buttons, rings, and empty-slot tints.
 * Tile fills come from per-park `bg_colour` via `theme-colours` transforms.
 * Page background stays cream (`bg-cream` on the planner shell).
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
  /**
   * Smart Plan / Ask Trip, focus rings, empty-slot tint base.
   * Matches the spec accent list per theme.
   */
  ring: string;
};

export const THEMES: Record<ThemeKey, ThemeDefinition> = {
  classic: {
    name: "Classic",
    label: "Classic",
    ring: "#0B1E5C",
  },
  pastel: {
    name: "Pastel Dream",
    label: "Pastel Dream",
    ring: "#8FA3BF",
  },
  sunset: {
    name: "Sunset",
    label: "Sunset",
    ring: "#C4929E",
  },
  ocean: {
    name: "Ocean",
    label: "Ocean",
    ring: "#7FB5BF",
  },
  garden: {
    name: "Garden",
    label: "Garden",
    ring: "#8FB5A3",
  },
  berry: {
    name: "Berry",
    label: "Berry",
    ring: "#B88FAD",
  },
} as const;

export function isThemeKey(v: string | null | undefined): v is ThemeKey {
  return v != null && (THEME_KEYS as readonly string[]).includes(v);
}

export function normaliseThemeKey(v: string | null | undefined): ThemeKey {
  return isThemeKey(v) ? v : "classic";
}

/** CSS variables for planner subtree (accent-driven UI only). */
export function plannerThemeStyleVars(key: ThemeKey): CSSProperties {
  const t = THEMES[key];
  return {
    "--tt-ring": t.ring,
    "--tt-accent": t.ring,
  } as CSSProperties;
}

/** Empty calendar / mobile slot: subtle tint from the theme accent. */
export function themedEmptySlotSurfaceStyle(): CSSProperties {
  return {
    backgroundColor: "color-mix(in srgb, var(--tt-ring) 10%, #ffffff)",
  } as CSSProperties;
}
