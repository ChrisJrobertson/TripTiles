import type { CSSProperties } from "react";

/**
 * Planner colour presets (per-trip). PDF export stays on brand defaults.
 * Non-classic themes use soft pastel primaries (high lightness) with dark text for contrast.
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
  primary: string;
  accent: string;
  background: string;
  primarySoft: string;
  accentSoft: string;
  text: string;
  textMuted: string;
};

export const THEMES: Record<ThemeKey, ThemeDefinition> = {
  classic: {
    name: "Classic",
    label: "Classic",
    primary: "#0B1E5C",
    accent: "#C9A961",
    background: "#FAF8F3",
    primarySoft: "#1a2f75",
    accentSoft: "#dcc89a",
    text: "#0B1E5C",
    textMuted: "#5c6480",
  },
  pastel: {
    name: "Pastel Dream",
    label: "Pastel dream",
    primary: "#8FA3BF",
    accent: "#E0B8A0",
    background: "#F7F2EE",
    primarySoft: "#a8b8ce",
    accentSoft: "#edd0c0",
    text: "#3d4a5c",
    textMuted: "#6b7280",
  },
  sunset: {
    name: "Sunset",
    label: "Sunset",
    primary: "#C4929E",
    accent: "#F0C5A8",
    background: "#FDF5F0",
    primarySoft: "#d4b0b8",
    accentSoft: "#f5dcc8",
    text: "#5c3d45",
    textMuted: "#7a6a6f",
  },
  ocean: {
    name: "Ocean",
    label: "Ocean",
    primary: "#7FB5BF",
    accent: "#B5DFDF",
    background: "#F2F8F8",
    primarySoft: "#9fcad2",
    accentSoft: "#d4ecec",
    text: "#2D5C63",
    textMuted: "#5a757a",
  },
  garden: {
    name: "Garden",
    label: "Garden",
    primary: "#8FB5A3",
    accent: "#D4E4B8",
    background: "#F5F8F2",
    primarySoft: "#aac9b9",
    accentSoft: "#e4efd0",
    text: "#3d5247",
    textMuted: "#5f6d66",
  },
  berry: {
    name: "Berry",
    label: "Berry",
    primary: "#B88FAD",
    accent: "#E4C4DA",
    background: "#FAF4F8",
    primarySoft: "#cca9c2",
    accentSoft: "#efd9e8",
    text: "#4a3d46",
    textMuted: "#6d5f68",
  },
} as const;

export function isThemeKey(v: string | null | undefined): v is ThemeKey {
  return v != null && (THEME_KEYS as readonly string[]).includes(v);
}

export function normaliseThemeKey(v: string | null | undefined): ThemeKey {
  return isThemeKey(v) ? v : "classic";
}

/** Inline style object for CSS variables consumed by planner subtree. */
export function plannerThemeStyleVars(key: ThemeKey): CSSProperties {
  const t = THEMES[key];
  return {
    "--tt-primary": t.primary,
    "--tt-accent": t.accent,
    "--tt-bg": t.background,
    "--tt-primary-soft": t.primarySoft,
    "--tt-accent-soft": t.accentSoft,
    "--tt-text": t.text,
    "--tt-text-muted": t.textMuted,
  } as CSSProperties;
}
