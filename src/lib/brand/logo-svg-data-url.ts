import { LOGO_ROYAL_DEEP_HEX } from "@/components/brand/logo-constants";

/**
 * Raster-free brand tile for `@vercel/og` / Satori: PNG img `src` can't use CSS `conic-gradient`,
 * but embedded SVG `<img src="data:...">` renders reliably across favicon + OG canvases.
 */
export function logoMarkSvgDataUrl(): string {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="r" x1="8%" y1="12%" x2="92%" y2="88%">
      <stop offset="0%" stop-color="#43c067"/>
      <stop offset="18%" stop-color="#2f93de"/>
      <stop offset="40%" stop-color="#7c61ff"/>
      <stop offset="58%" stop-color="#e255a8"/>
      <stop offset="76%" stop-color="#ff9540"/>
      <stop offset="92%" stop-color="#f2d049"/>
      <stop offset="100%" stop-color="#43c067"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="28" fill="url(#r)"/>
  <rect x="5" y="5" width="90" height="90" rx="22" fill="#ffffff"/>
  <text x="50" y="64" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="44" font-weight="700" fill="${LOGO_ROYAL_DEEP_HEX}">T</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
