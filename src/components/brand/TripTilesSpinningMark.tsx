"use client";

import { useEffect, useState } from "react";

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

function displayHeightForWidth(dw: number) {
  return dw / CELL_ASPECT;
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

const FRAME_MS = 72;

/**
 * Loading mark: **Tripp** 12-frame sprite (row-major 3×4 sheet) on a static
 * frame; pauses on frame 0 when `prefers-reduced-motion` is set.
 */
export function TripTilesSpinningMark({
  size = "md",
  className = "",
  surface = "light",
}: Props) {
  const dw = displayWidthPx[size];
  const dh = displayHeightForWidth(dw);
  const pad = 6;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const id = window.setInterval(
      () => setFrame((f) => (f + 1) % FRAME_COUNT),
      FRAME_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const col = frame % SPRITE_COLS;
  const row = Math.floor(frame / SPRITE_COLS);

  return (
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
        className="relative z-[1] shrink-0 drop-shadow-md motion-reduce:opacity-100"
        style={{
          width: dw,
          height: dh,
          backgroundImage: `url(${TRIPP_LOADING_SPRITE_SRC})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${dw * SPRITE_COLS}px ${dh * SPRITE_ROWS}px`,
          backgroundPosition: `${-col * dw}px ${-row * dh}px`,
        }}
        role="img"
        aria-label="TripTiles loading"
      />
    </div>
  );
}
