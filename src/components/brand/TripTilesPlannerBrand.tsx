import Link from "next/link";

/** Rainbow ring + white centre + navy serif “T”, matching TripTiles nav reference art. */
const LOGO_TILE_CONIC =
  "conic-gradient(from 140deg at 50% 50%, #43c067 0deg, #2f93de 70deg, #7c61ff 155deg, #e255a8 235deg, #ff9540 300deg, #f2d049 338deg, #43c067 360deg)";

/**
 * Planner / app shell lockup — white squircle tile, gradient border ring, serif wordmark (reference asset 2).
 */
export function TripTilesPlannerBrand({
  href,
  className = "",
}: {
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex shrink-0 items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-tt-gold/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`.trim()}
    >
      <span
        className="shrink-0 rounded-2xl p-[2.5px] shadow-[0_1px_3px_rgba(21,32,58,0.12)] sm:rounded-[14px] sm:p-[3px]"
        style={{ background: LOGO_TILE_CONIC }}
        aria-hidden
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-white sm:h-10 sm:w-10 sm:rounded-[13px]">
          <span className="font-heading text-[1.125rem] font-bold leading-none text-tt-royal-deep sm:text-[1.3125rem]">
            T
          </span>
        </span>
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block font-heading text-base font-semibold tracking-tight text-tt-royal-deep transition group-hover:text-tt-royal sm:text-lg">
          TripTiles
        </span>
        <span className="block font-sans text-[9px] font-semibold uppercase tracking-[0.32em] text-tt-ink-soft sm:text-[10px] sm:tracking-[0.34em]">
          Adventure planning
        </span>
      </span>
    </Link>
  );
}

function emailInitialLetter(email: string): string {
  const m = email.trim();
  if (!m) return "?";
  return m[0]!.toUpperCase();
}

export function UserAvatarInitial({
  email,
  className = "",
}: {
  email: string;
  className?: string;
}) {
  const letter = emailInitialLetter(email);
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8b74ff] via-[#6c4cff] to-[#4f36b8] font-sans text-xs font-semibold uppercase text-white shadow-sm ring-2 ring-white sm:h-9 sm:w-9 sm:text-sm ${className}`.trim()}
      title={email}
      aria-hidden
    >
      {letter}
    </span>
  );
}
