"use client";

const SIZE_PX = { sm: 22, md: 40, lg: 64 } as const;

type Size = keyof typeof SIZE_PX;

type Props = {
  size?: Size;
  className?: string;
  label?: string;
  /** Centres in a blurred overlay over a positioned parent. */
  fullscreen?: boolean;
  /** Lighter/contrast ring for dark backgrounds (e.g. royal buttons). */
  variant?: "default" | "onDark";
  fullscreenClassName?: string;
  /** When a parent region already announces loading. */
  decorative?: boolean;
};

function ringClasses(variant: "default" | "onDark"): string {
  if (variant === "onDark") {
    return "border-cream/30 border-t-cream animate-spin";
  }
  return "border-tt-line border-t-tt-royal animate-spin";
}

/**
 * Neutral loading indicator: CSS ring spinner (no mascot assets).
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

  const mark = (
    <span
      className={`inline-block shrink-0 rounded-full border-2 ${ringClasses(variant)}`.trim()}
      style={{ width: dim, height: dim, borderStyle: "solid" }}
      aria-hidden
    />
  );

  const showSkeletonBars = fullscreen || (!decorative && size !== "sm");

  const content = (
    <span
      className={`inline-flex flex-col items-center justify-center gap-3 ${className}`.trim()}
    >
      {decorative ? null : <span className="sr-only">Loading</span>}
      {showSkeletonBars ? (
        <>
          <span className="flex flex-col items-center gap-2">
            <span className="h-10 w-[min(240px,80vw)] animate-pulse rounded-md border border-tt-line bg-tt-bg-soft" />
            <span className="h-2 w-32 animate-pulse rounded border border-tt-line bg-tt-bg-soft" />
          </span>
          {mark}
        </>
      ) : (
        mark
      )}
      {label ? (
        <span className="max-w-xs text-center font-sans text-sm text-tt-ink-muted">
          {label}
        </span>
      ) : null}
    </span>
  );

  if (fullscreen) {
    return (
      <div
        className={`pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center overflow-x-hidden overflow-y-auto bg-cream/80 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm ${fullscreenClassName}`.trim()}
        {...(decorative
          ? { "aria-hidden": true as const }
          : {
              role: "status" as const,
              "aria-live": "polite" as const,
              "aria-busy": true as const,
            })}
      >
        <div className="flex flex-col items-center px-6">{content}</div>
      </div>
    );
  }

  return content;
}
