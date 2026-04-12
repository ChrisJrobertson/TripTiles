import type { CSSProperties } from "react";

/**
 * Planner colour presets (per-trip). PDF export stays on brand defaults.
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
    primary: "#6B7FA3",
    accent: "#D4A88C",
    background: "#F5F0EB",
    primarySoft: "#8a9ab8",
    accentSoft: "#e8c4b0",
    text: "#2d3142",
    textMuted: "#6b7280",
  },
  sunset: {
    name: "Sunset",
    label: "Sunset",
    primary: "#8B5E6B",
    accent: "#E8A87C",
    background: "#FDF6F0",
    primarySoft: "#a67a86",
    accentSoft: "#f2c09f",
    text: "#3d2a30",
    textMuted: "#6b5c62",
  },
  ocean: {
    name: "Ocean",
    label: "Ocean",
    primary: "#3D7A8A",
    accent: "#7EC8C8",
    background: "#F0F7F7",
    primarySoft: "#569bab",
    accentSoft: "#a8dede",
    text: "#1e3d45",
    textMuted: "#5a7a82",
  },
  garden: {
    name: "Garden",
    label: "Garden",
    primary: "#5B7B6F",
    accent: "#C4D4A0",
    background: "#F4F7F0",
    primarySoft: "#789688",
    accentSoft: "#d6e2b8",
    text: "#2a3a32",
    textMuted: "#5d6b63",
  },
  berry: {
    name: "Berry",
    label: "Berry",
    primary: "#7B4B6A",
    accent: "#D4A0C4",
    background: "#F9F2F7",
    primarySoft: "#956584",
    accentSoft: "#e6c0da",
    text: "#3a2434",
    textMuted: "#6b5a66",
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
