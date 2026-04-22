"use client";

const SIZE_PX = { sm: 24, md: 48, lg: 80 } as const;

type Size = keyof typeof SIZE_PX;

type Props = {
  size?: Size;
  className?: string;
  label?: string;
  /** Fills a positioned parent with a cream blur layer and centres the mark. */
  fullscreen?: boolean;
  /** Light arc for the royal primary CTA. */
  variant?: "default" | "onDark";
  /** Merged into the fullscreen layer (e.g. z-index). */
  fullscreenClassName?: string;
  /** When a parent region already announces loading (e.g. full-screen overlay). */
  decorative?: boolean;
};

/**
 * Branded loading mark: gold arc on a royal disc (no separate asset).
 * If you add a true brand mark, swap the SVG in here.
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
  const vb = 48;
  const r = 20;
  const c = vb / 2;
  const pad = 2;

  const disc = isOnDark ? null : (
    <circle key="bg" cx={c} cy={c} r={r} fill="#0B1E5C" />
  );
  const arcStroke = isOnDark ? "#FAF8F3" : "#C9A961";

  const svg = (
    <svg
      width={dim}
      height={dim}
      viewBox={`0 0 ${vb} ${vb}`}
      className="not-motion-reduce:animate-[spin_1.2s_linear_infinite] motion-reduce:animate-pulse"
      style={{ willChange: "transform" }}
      aria-hidden
    >
      {disc}
      <path
        d={`M ${c} ${pad} A ${r} ${r} 0 0 1 ${vb - pad} ${c}`}
        fill="none"
        stroke={arcStroke}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );

  const content = (
    <span
      className={`inline-flex flex-col items-center justify-center ${className}`.trim()}
    >
      {decorative ? null : <span className="sr-only">Loading</span>}
      {svg}
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
