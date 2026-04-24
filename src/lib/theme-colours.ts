import type { CSSProperties } from "react";

import { THEMES, type ThemeKey } from "./themes";

/** Per-theme HSL adjustments for catalogue tile backgrounds (not Classic). */
export interface ThemeTransform {
  lighten: number;
  desaturate: number;
  hueShift: number;
}

export const THEME_TRANSFORMS: Record<ThemeKey, ThemeTransform> = {
  classic: { lighten: 0, desaturate: 0, hueShift: 0 },
  pastel: { lighten: 0.45, desaturate: 0.3, hueShift: 0 },
  sunset: { lighten: 0.4, desaturate: 0.2, hueShift: 10 },
  ocean: { lighten: 0.45, desaturate: 0.25, hueShift: -10 },
  garden: { lighten: 0.4, desaturate: 0.2, hueShift: 5 },
  berry: { lighten: 0.4, desaturate: 0.15, hueShift: 15 },
};

/** Representative tile colours for the theme picker preview (not from DB). */
export const THEME_PREVIEW_BASE_HEXES = [
  "#2455ac",
  "#2E7D32",
  "#E65100",
  "#546E7A",
] as const;

export function getThemeTransform(key: ThemeKey): ThemeTransform {
  return THEME_TRANSFORMS[key];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim();
  if (!h.startsWith("#")) return null;
  const raw = h.slice(1);
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0]! + raw[0]!, 16),
      g: parseInt(raw[1]! + raw[1]!, 16),
      b: parseInt(raw[2]! + raw[2]!, 16),
    };
  }
  if (raw.length === 6) {
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    };
  }
  return null;
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        break;
      case gn:
        h = ((bn - rn) / d + 2) / 6;
        break;
      default:
        h = ((rn - gn) / d + 4) / 6;
        break;
    }
  }
  return { h: h * 360, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hn) * 255),
    b: Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const x = (n: number) =>
    clamp(Math.round(n), 0, 255)
      .toString(16)
      .padStart(2, "0");
  return `#${x(r)}${x(g)}${x(b)}`;
}

/**
 * Blends a hex toward white so park tiles read as lighter pastels (less heavy on screen).
 * `amount` 0 = unchanged, 1 = white.
 */
function mixHexTowardWhite(hex: string, amount: number): string {
  const t = clamp(amount, 0, 1);
  if (t === 0) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const m = (c: number) => Math.round(c + (255 - c) * t);
  return rgbToHex(m(rgb.r), m(rgb.g), m(rgb.b));
}

/** How much to lighten catalogue tile fills (on top of theme transforms). */
const TILE_PASTEL_WHITEN = 0.46;

const PASTEL_L_MIN = 0.68;
const PASTEL_L_MAX = 0.9;
const PASTEL_S_FLOOR = 0.07;

/**
 * Softens a hex catalogue colour for the active theme. Classic returns the
 * original hex unchanged.
 */
export function applyThemeToColour(hex: string, theme: ThemeTransform): string {
  if (theme.lighten === 0 && theme.desaturate === 0 && theme.hueShift === 0) {
    return hex;
  }
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  l = clamp(l + (1 - l) * theme.lighten, 0, 1);
  s = clamp(s * (1 - theme.desaturate), 0, 1);
  s = Math.max(PASTEL_S_FLOOR, s);
  h = (h + theme.hueShift + 360) % 360;
  l = clamp(l, PASTEL_L_MIN, PASTEL_L_MAX);
  const out = hslToRgb(h, s, l);
  return rgbToHex(out.r, out.g, out.b);
}

export function getContrastText(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return "#1A1A2E";
  const { l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return l > 0.65 ? "#1A1A2E" : "#FFFFFF";
}

export function resolveTileTextColour(
  themeKey: ThemeKey,
  transformedBgHex: string,
  originalFgHex: string | null | undefined,
): string {
  if (
    themeKey === "classic" &&
    typeof originalFgHex === "string" &&
    /^#/.test(originalFgHex)
  ) {
    return originalFgHex;
  }
  return getContrastText(transformedBgHex);
}

function uiAccentBorder(themeKey: ThemeKey): string {
  const ring = THEMES[themeKey].ring;
  const rgb = hexToRgb(ring);
  if (!rgb) return "rgba(11, 30, 92, 0.15)";
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`;
}

/**
 * Calendar / palette / mobile tile: transformed background, readable text,
 * subtle border from the theme UI accent.
 */
export function parkChromaTileStyle(
  bgColour: string | undefined,
  /** Kept for API compatibility; contrast is derived from the lightened fill. */
  _fgColour: string | undefined,
  themeKey: ThemeKey,
): CSSProperties {
  const raw =
    typeof bgColour === "string" && /^#/.test(bgColour) ? bgColour : "#2455ac";
  const bg = applyThemeToColour(raw, getThemeTransform(themeKey));
  const displayBg = mixHexTowardWhite(bg, TILE_PASTEL_WHITEN);
  /** Lightened tiles need contrast based on the actual fill, not legacy white-on-dark assumptions. */
  const color = getContrastText(displayBg);
  return {
    backgroundColor: displayBg,
    color,
    border: `1px solid ${uiAccentBorder(themeKey)}`,
  } as CSSProperties;
}
