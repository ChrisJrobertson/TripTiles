"use client";

import { useId, useMemo } from "react";

/** 12-frame Tripp rotation sprite (3×4 grid), keyed for transparent backdrop. */
export const TRIPP_LOADING_SPRITE_SRC = "/images/tripp-loading-sprite.png";

const FRAMES = 12;
const COLS = 3;
const ROWS = 4;

const SPRITE_INTRINSIC_W = 1024;
const SPRITE_INTRINSIC_H = 819;

const CELL_INTRINSIC_W = SPRITE_INTRINSIC_W / COLS;
const CELL_INTRINSIC_H = SPRITE_INTRINSIC_H / ROWS;
const CELL_ASPECT = CELL_INTRINSIC_W / CELL_INTRINSIC_H;

const displayWidthPx = { md: 92, lg: 116 } as const;

/** ms per frame — full loop = FRAMES × this value. */
const FRAME_MS = 72;
const DURATION_MS = FRAME_MS * FRAMES;

function displayHeightForWidth(dw: number) {
  return dw / CELL_ASPECT;
}

/**
 * Hold keyframes: each position is held for 1/FRAMES of the cycle, no tween.
 * `linear` timing is correct here — the curve does not add interpolation within
 * each [start%, end%] block. (`steps(1)` on the whole run would be a single jump.)
 */
function spriteStyleBlock(
  className: string,
  dw: number,
  dh: number,
  spriteUrl: string,
): string {
  const keyframes = Array.from({ length: FRAMES }, (_, f) => {
    const col = f % COLS;
    const row = Math.floor(f / COLS);
    const x = Math.round(-col * dw);
    const y = Math.round(-row * dh);
    const start = ((f / FRAMES) * 100).toFixed(4);
    const end = (((f + 1) / FRAMES) * 100 - 0.0001).toFixed(4);
    return `${start}%, ${end}% { background-position: ${x}px ${y}px; }`;
  }).join("\n          ");

  return `
        @keyframes ${className} {
          ${keyframes}
        }
        .${className} {
          width: ${dw}px;
          height: ${dh}px;
          background-image: url("${spriteUrl}");
          background-size: ${dw * COLS}px ${dh * ROWS}px;
          background-repeat: no-repeat;
          background-position: 0 0;
          animation: ${className} ${DURATION_MS}ms linear infinite;
          will-change: background-position;
        }
        @media (prefers-reduced-motion: reduce) {
          .${className} {
            animation-duration: ${DURATION_MS * 3}ms;
          }
        }`;
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
  /**
   * If the mark sits in an existing `role=status` region, avoid a nested status
   * (invalid pattern) and hide the sprite from screen readers; copy still announces.
   */
  announceViaParent?: boolean;
};

const staticFrame: Record<NonNullable<Props["surface"]>, string> = {
  light:
    "border-gold/30 bg-gradient-to-b from-white/50 to-gold/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
  dark:
    "border-cream/25 bg-gradient-to-b from-cream/[0.12] to-royal/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
};

/**
 * Loading mark: **Tripp** 12-frame sprite (row-major 3×4 sheet) on a static frame.
 * Pure CSS (no rAF) so the animation runs in the App Router loading segment.
 */
export function TripTilesSpinningMark({
  size = "md",
  className = "",
  surface = "light",
  announceViaParent = false,
}: Props) {
  const rawId = useId();
  const id = `tripp-${rawId.replace(/[:]/g, "")}`;
  const dw = displayWidthPx[size];
  const dh = displayHeightForWidth(dw);
  const pad = 6;

  const spriteCss = useMemo(
    () => spriteStyleBlock(id, dw, dh, TRIPP_LOADING_SPRITE_SRC),
    [id, dw, dh],
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
          className={`relative z-[1] shrink-0 drop-shadow-md ${id}`}
          {...(announceViaParent
            ? { "aria-hidden": true as const }
            : { role: "status" as const, "aria-label": "TripTiles loading" })}
        />
      </div>
    </>
  );
}
