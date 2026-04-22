"use client";

import { useId, useMemo } from "react";

/** 12-frame Tripp rotation sprite (3×4 grid), keyed for transparent backdrop. */
export const TRIPP_LOADING_SPRITE_SRC = "/images/tripp-loading-sprite.png";

const SPRITE_INTRINSIC_W = 1024;
const SPRITE_INTRINSIC_H = 819;
const SPRITE_COLS = 3;
const SPRITE_ROWS = 4;
const FRAME_COUNT = SPRITE_COLS * SPRITE_ROWS;

const CELL_INTRINSIC_W = SPRITE_INTRINSIC_W / SPRITE_COLS;
const CELL_INTRINSIC_H = SPRITE_INTRINSIC_H / SPRITE_ROWS;
const CELL_ASPECT = CELL_INTRINSIC_W / CELL_INTRINSIC_H;

const displayWidthPx = { md: 92, lg: 116 } as const;

/** ms per frame — total loop = FRAME_COUNT * FRAME_MS */
const FRAME_MS = 72;

function displayHeightForWidth(dw: number) {
  return dw / CELL_ASPECT;
}

/**
 * Hold-style keyframes so `linear` animation stays crisp (no tween between frames).
 * CSS-only: required for `loading.tsx` where React may skip hydrating fallbacks, so
 * `useEffect` never runs (see Next.js #41972).
 */
function spriteAnimationCss(animName: string, dw: number, dh: number): string {
  const segs: string[] = [];
  const step = 100 / FRAME_COUNT;
  for (let f = 0; f < FRAME_COUNT; f++) {
    const startPct = f * step;
    const endPct = f === FRAME_COUNT - 1 ? 100 : (f + 1) * step - 1e-4;
    const col = f % SPRITE_COLS;
    const row = Math.floor(f / SPRITE_COLS);
    const x = (-col * dw).toFixed(3);
    const y = (-row * dh).toFixed(3);
    segs.push(
      `${startPct.toFixed(4)}%, ${endPct.toFixed(4)}% { background-position: ${x}px ${y}px; }`,
    );
  }

  const durationMs = FRAME_MS * FRAME_COUNT;

  return `
@keyframes ${animName} {
${segs.join("\n")}
}
.${animName} {
  animation: ${animName} ${durationMs}ms linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .${animName} { animation: none !important; }
}
`;
}

type Props = {
  /** Logical width of one sprite cell on screen. */
  size?: "md" | "lg";
  className?: string;
  /**
   * Non-spinning frame behind the sprite — match the surface it sits on
   * (cream vs royal).
   */
  surface?: "light" | "dark";
};

const staticFrame: Record<NonNullable<Props["surface"]>, string> = {
  light:
    "border-gold/30 bg-gradient-to-b from-white/50 to-gold/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
  dark:
    "border-cream/25 bg-gradient-to-b from-cream/[0.12] to-royal/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
};

/**
 * Loading mark: **Tripp** 12-frame sprite (row-major 3×4 sheet) on a static frame.
 * Uses **CSS keyframe animation** (not `useEffect`) so it plays in App Router
 * `loading.tsx` fallbacks, which are often not hydrated.
 */
export function TripTilesSpinningMark({
  size = "md",
  className = "",
  surface = "light",
}: Props) {
  const uid = useId().replace(/:/g, "_");
  const animName = `tripp-sprite-${uid}`;
  const dw = displayWidthPx[size];
  const dh = displayHeightForWidth(dw);
  const pad = 6;

  const spriteCss = useMemo(
    () => spriteAnimationCss(animName, dw, dh),
    [animName, dw, dh],
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: spriteCss }} />
      <div
        className={`relative inline-flex items-center justify-center ${className}`.trim()}
        style={{
          width: dw + pad * 2,
          height: dh + pad * 2,
        }}
      >
        <div
          className={`pointer-events-none absolute inset-0 rounded-2xl ${staticFrame[surface]}`}
          aria-hidden
        />
        <div
          className={`relative z-[1] shrink-0 drop-shadow-md ${animName}`}
          style={{
            width: dw,
            height: dh,
            backgroundImage: `url(${TRIPP_LOADING_SPRITE_SRC})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${dw * SPRITE_COLS}px ${dh * SPRITE_ROWS}px`,
            backgroundPosition: "0 0",
          }}
          role="img"
          aria-label="TripTiles loading"
        />
      </div>
    </>
  );
}
