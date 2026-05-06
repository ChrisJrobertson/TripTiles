import Link from "next/link";

/**
 * Planner / app shell lockup — wordmark stack with a compact “T” tile (matches redesign nav).
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
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/35 bg-gradient-to-br from-[#7c69f8] via-[#5b4cdb] to-[#3d2ea8] font-heading text-sm font-bold text-white shadow-sm sm:h-10 sm:w-10"
        aria-hidden
      >
        T
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block font-heading text-base font-semibold tracking-tight text-tt-royal transition group-hover:text-tt-royal-deep sm:text-lg">
          TripTiles
        </span>
        <span className="block font-meta text-[9px] font-semibold uppercase tracking-[0.22em] text-tt-ink-soft sm:text-[10px] sm:tracking-[0.26em]">
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
