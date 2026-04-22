"use client";

import { TripTilesSpinningMark } from "@/components/brand/TripTilesSpinningMark";

type Tone = "light" | "dark";

type Props = {
  open: boolean;
  title?: string;
  caption?: string;
  /** `light` = cream blur (auth, global). `dark` = royal (Smart Plan full-screen). */
  tone?: Tone;
};

const toneSurfaces: Record<Tone, string> = {
  light:
    "bg-cream/92 text-royal backdrop-blur-md [&_.caption]:text-royal/65 [&_.title]:text-royal",
  dark:
    "bg-royal/88 text-cream backdrop-blur-sm [&_.caption]:text-cream/85 [&_.title]:text-cream",
};

/**
 * Full-viewport branded loading — spinning TripTiles mark (no generic dot spinner).
 */
export function TripTilesLoadingOverlay({
  open,
  title = "Loading…",
  caption = "This only takes a moment.",
  tone = "light",
}: Props) {
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[700] flex flex-col items-center justify-center gap-5 px-6 py-10 ${toneSurfaces[tone]}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <TripTilesSpinningMark size="lg" surface={tone} />
      <p className="title max-w-sm text-center font-serif text-lg font-semibold tracking-tight">
        {title}
      </p>
      {caption ? (
        <p className="caption max-w-xs text-center font-sans text-sm">{caption}</p>
      ) : null}
    </div>
  );
}
