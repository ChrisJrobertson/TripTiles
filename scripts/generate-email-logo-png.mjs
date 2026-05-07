#!/usr/bin/env node
/**
 * Writes `public/email/logo-compact.png` and `logo-full.png` from inline SVG → sharp raster.
 * Uses the hoisted Next.js `sharp` dependency (no package.json additions).
 *
 * Usage: node scripts/generate-email-logo-png.mjs
 */

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const ROYAL = "#173b7d";
const INK_SOFT = "#6c7891";

const DEFS = `
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
  </defs>`;

function svgCompact() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="120" viewBox="0 0 520 120">
  <rect width="520" height="120" fill="#ffffff"/>
  ${DEFS}
  <g transform="translate(12,12)">
    <rect width="96" height="96" rx="26" fill="url(#r)"/>
    <rect x="5" y="5" width="86" height="86" rx="20" fill="#ffffff"/>
    <text x="48" y="62" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="40" font-weight="700" fill="${ROYAL}">T</text>
  </g>
  <text x="128" y="74" font-family="Georgia,Times New Roman,serif" font-size="42" font-weight="600" fill="${ROYAL}">TripTiles</text>
</svg>`;
}

function svgFull() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="620" height="170" viewBox="0 0 620 170">
  <rect width="620" height="170" fill="#ffffff"/>
  ${DEFS}
  <g transform="translate(16,22)">
    <rect width="112" height="112" rx="31" fill="url(#r)"/>
    <rect x="5" y="5" width="102" height="102" rx="24" fill="#ffffff"/>
    <text x="56" y="72" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="50" font-weight="700" fill="${ROYAL}">T</text>
  </g>
  <text x="154" y="96" font-family="Georgia,Times New Roman,serif" font-size="46" font-weight="600" fill="${ROYAL}">TripTiles</text>
  <text x="154" y="132" font-family="Inter,Segoe UI,system-ui,sans-serif" font-size="13" font-weight="600" letter-spacing="0.38em" fill="${INK_SOFT}">ADVENTURE PLANNING</text>
</svg>`;
}

async function main() {
  mkdirSync("public/email", { recursive: true });
  await sharp(Buffer.from(svgCompact())).png().toFile("public/email/logo-compact.png");
  await sharp(Buffer.from(svgFull())).png().toFile("public/email/logo-full.png");
  console.log("Wrote public/email/logo-compact.png and public/email/logo-full.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
