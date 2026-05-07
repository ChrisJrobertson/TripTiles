/* eslint-disable @next/next/no-img-element -- data-URL SVG tile for OG / Satori */

import { LOGO_ROYAL_DEEP_HEX } from "@/components/brand/logo-constants";
import { logoMarkSvgDataUrl } from "@/lib/brand/logo-svg-data-url";

const INK_SOFT = "#6c7891";

type OgLogoLockupProps = {
  /** Tighter lockup for plan OG header row. */
  compact?: boolean;
};

/**
 * Full brand lockup for `ImageResponse` (data-URL SVG tile + typographic wordmark + tagline).
 * Satori rejects parents whose children include whitespace-only text nodes between tags.
 */
export function OgLogoLockup({ compact = false }: OgLogoLockupProps) {
  const src = logoMarkSvgDataUrl();
  const imgPx = compact ? 72 : 112;
  const titlePx = compact ? 40 : 56;
  const tagPx = compact ? 11 : 15;
  const gap = compact ? 18 : 28;
  const titleMargin = compact ? 6 : 10;

  // prettier-ignore
  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap }}><div style={{ display: "flex" }}><img src={src} width={imgPx} height={imgPx} alt="" /></div><div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: titleMargin }}><div style={{ fontSize: titlePx, fontFamily: "Georgia, serif", color: LOGO_ROYAL_DEEP_HEX, fontWeight: 600, lineHeight: 1.05 }}>TripTiles</div><div style={{ fontSize: tagPx, letterSpacing: "0.36em", color: INK_SOFT, fontWeight: 600, textTransform: "uppercase" }}>ADVENTURE PLANNING</div></div></div>
  );
}
