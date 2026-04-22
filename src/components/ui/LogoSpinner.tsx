"use client";

const SIZE_PX = { sm: 24, md: 48, lg: 80 } as const;

/** Tripp explorer mascot — swap path if the asset is replaced with a true transparent PNG. */
const MARK_SRC = "/images/tripp-spinner-mascot.jpg";

type Size = keyof typeof SIZE_PX;

type Props = {
  size?: Size;
  className?: string;
  label?: string;
  /** Fills a positioned parent with a cream blur layer and centres the mark. */
  fullscreen?: boolean;
  /** Lighter ring for use on the royal primary CTA. */
  variant?: "default" | "onDark";
  /** Merged into the fullscreen layer (e.g. z-index). */
  fullscreenClassName?: string;
  /** When a parent region already announces loading (e.g. full-screen overlay). */
  decorative?: boolean;
};

/**
 * Branded loading mark: Tripp mascot image with spin (or pulse when reduced motion).
 */
export function LogoSpinner({
  size = "md",
  className = "",
  label,
  fullscreen = false,
  variant = "default",
  fullscreenClassName = "",
  decorative = false,
}: Props) {
  const dim = SIZE_PX[size];
  const isOnDark = variant === "onDark";

  const mark = (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-full bg-cream not-motion-reduce:animate-[spin_1.2s_linear_infinite] motion-reduce:animate-pulse ${
        isOnDark
          ? "ring-2 ring-cream/95 ring-offset-0"
          : "ring-1 ring-royal/20 shadow-sm"
      }`.trim()}
      style={{ width: dim, height: dim, willChange: "transform" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small fixed spinner asset */}
      <img
        src={MARK_SRC}
        alt=""
        width={dim}
        height={dim}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </span>
  );

  const content = (
    <span
      className={`inline-flex flex-col items-center justify-center ${className}`.trim()}
    >
      {decorative ? null : <span className="sr-only">Loading</span>}
      {mark}
      {label ? (
        <span className="mt-2 max-w-xs text-center font-sans text-sm text-[#0B1E5C]/70">
          {label}
        </span>
      ) : null}
    </span>
  );

  if (fullscreen) {
    return (
      <div
        className={`absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-[#FAF8F3]/80 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm pointer-events-auto ${fullscreenClassName}`.trim()}
        {...(decorative
          ? { "aria-hidden": true as const }
          : {
              role: "status" as const,
              "aria-live": "polite" as const,
              "aria-busy": true as const,
            })}
      >
        {content}
      </div>
    );
  }

  if (decorative) {
    return <span className="inline-flex flex-col items-center" aria-hidden>{content}</span>;
  }

  return (
    <div role="status" className="inline-flex flex-col items-center">
      {content}
    </div>
  );
}
