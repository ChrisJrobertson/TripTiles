import Link from "next/link";
import {
  LOGO_TAGLINE,
  LOGO_TILE_CONIC,
} from "@/components/brand/logo-constants";

export type LogoVariant = "icon" | "compact" | "full";

/** Pixel scale presets for TripTiles branded surfaces. */
export type LogoSizePreset =
  /** App shell nav compact lockup (~32–40px tile height). */
  | "nav"
  /** Footer compact — slightly larger than nav. */
  | "footer"
  /** Marketing home / hero band — tall full lockup. */
  | "marketing"
  /** Login, signup, forgot password, wizard. */
  | "auth"
  /** Email verify / check-email stripes. */
  | "inline";

type MarkStyle = {
  ring: string;
  inner: string;
  t: string;
  word: string;
  tagline: string;
};

const PRESETS: Record<LogoSizePreset, MarkStyle> = {
  nav: {
    ring:
      "rounded-2xl p-[2.5px] shadow-[0_1px_3px_rgba(21,32,58,0.12)] sm:rounded-[14px] sm:p-[3px]",
    inner:
      "flex h-9 w-9 items-center justify-center rounded-[11px] bg-white sm:h-10 sm:w-10 sm:rounded-[13px]",
    t: "text-[1.125rem] font-bold leading-none sm:text-[1.3125rem]",
    word:
      "text-base font-semibold tracking-tight sm:text-lg transition group-hover:text-tt-royal",
    tagline:
      "font-sans text-[9px] font-semibold uppercase tracking-[0.34em] text-tt-ink-soft sm:text-[10px]",
  },
  footer: {
    ring:
      "rounded-2xl p-[2.5px] shadow-[0_1px_3px_rgba(21,32,58,0.12)] sm:rounded-[16px] sm:p-[3px]",
    inner:
      "flex h-10 w-10 items-center justify-center rounded-[12px] bg-white sm:h-11 sm:w-11 sm:rounded-[14px]",
    t: "text-xl font-bold leading-none sm:text-2xl",
    word:
      "text-lg font-semibold tracking-tight sm:text-xl transition group-hover:text-tt-royal",
    tagline:
      "font-sans text-[9px] font-semibold uppercase tracking-[0.34em] text-tt-ink-soft sm:text-[10px]",
  },
  marketing: {
    ring: "rounded-3xl p-1 shadow-md sm:rounded-[22px] sm:p-[5px]",
    inner:
      "flex h-14 w-14 items-center justify-center rounded-[14px] bg-white sm:h-[4.25rem] sm:w-[4.25rem] sm:rounded-[17px] md:h-20 md:w-20 md:rounded-[20px]",
    t: "text-[1.75rem] font-bold leading-none sm:text-[2rem] md:text-[2.25rem]",
    word:
      "text-2xl font-semibold tracking-tight transition group-hover:text-tt-royal sm:text-3xl md:text-4xl",
    tagline:
      "font-sans text-[9px] font-semibold uppercase tracking-[0.38em] text-tt-ink-soft sm:text-[10px] md:text-[11px]",
  },
  auth: {
    ring:
      "rounded-3xl p-[3px] shadow-[0_2px_6px_rgba(21,32,58,0.12)] sm:rounded-[18px] sm:p-1",
    inner:
      "flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[13px] bg-white sm:h-14 sm:w-14 sm:rounded-[15px] md:h-16 md:w-16 md:rounded-[17px]",
    t: "text-[1.4rem] font-bold leading-none sm:text-2xl md:text-[1.75rem]",
    word:
      "text-xl font-semibold tracking-tight transition group-hover:text-tt-royal sm:text-2xl md:text-3xl",
    tagline:
      "font-sans text-[9px] font-semibold uppercase tracking-[0.36em] text-tt-ink-soft sm:text-[10px]",
  },
  inline: {
    ring: "rounded-2xl p-[2px] shadow-sm sm:rounded-[14px] sm:p-[2.5px]",
    inner:
      "flex h-10 w-10 items-center justify-center rounded-[11px] bg-white sm:h-11 sm:w-11 sm:rounded-[12px]",
    t: "text-lg font-bold leading-none sm:text-xl",
    word:
      "text-lg font-semibold tracking-tight sm:text-xl transition group-hover:text-tt-royal",
    tagline:
      "font-sans text-[8px] font-semibold uppercase tracking-[0.34em] text-tt-ink-soft sm:text-[9px]",
  },
};

export type LogoProps = {
  variant?: LogoVariant;
  /** Ignored when `variant === "icon"`. Defaults: `compact`→`nav`, `full`→`auth`. */
  sizePreset?: LogoSizePreset;
  href?: string;
  className?: string;
  /** Defaults to `"TripTiles"`. */
  ariaLabel?: string;
  /** Matches common header backgrounds for the gold focus ring. */
  focusVisibleRingOffset?: "white" | "cream" | "surface";
};

function LogoMark({ preset }: { preset: LogoSizePreset }) {
  const s = PRESETS[preset];
  return (
    <span
      className={`shrink-0 ${s.ring}`}
      style={{ background: LOGO_TILE_CONIC }}
      aria-hidden
    >
      <span className={s.inner}>
        <span className={`font-heading ${s.t} text-tt-royal-deep`}>T</span>
      </span>
    </span>
  );
}

/**
 * Canonical TripTiles mark — programmatic gradient tile + serif wordmark + optional ADVENTURE PLANNING tagline.
 */
export function Logo({
  variant = "compact",
  sizePreset,
  href,
  className = "",
  ariaLabel = "TripTiles",
  focusVisibleRingOffset = "white",
}: LogoProps) {
  const preset: LogoSizePreset =
    sizePreset ??
    (variant === "compact" ? "nav" : variant === "icon" ? "nav" : "auth");

  const body = (
    <span className="inline-flex min-w-0 items-center gap-3">
      <LogoMark preset={preset} />
      {variant !== "icon" ? (
        <span className="min-w-0 leading-tight">
          <span
            className={`block font-heading text-tt-royal-deep group-hover:text-tt-royal ${PRESETS[preset].word}`}
          >
            TripTiles
          </span>
          {variant === "full" ? (
            <span className={`mt-0.5 block ${PRESETS[preset].tagline}`}>
              {LOGO_TAGLINE}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );

  const ringOffset =
    focusVisibleRingOffset === "cream"
      ? "focus-visible:ring-offset-tt-bg"
      : focusVisibleRingOffset === "surface"
        ? "focus-visible:ring-offset-tt-surface"
        : "focus-visible:ring-offset-white";
  const focus = `focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-gold/45 focus-visible:ring-offset-2 ${ringOffset}`;

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className={`group inline-flex shrink-0 items-center rounded-md ${focus} ${className}`.trim()}
      >
        {body}
      </Link>
    );
  }

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={`group inline-flex shrink-0 items-center ${className}`.trim()}
    >
      {body}
    </span>
  );
}
