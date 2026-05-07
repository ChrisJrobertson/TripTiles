/**
 * Lightweight segment fallback (no spinners, no status text) for (app) routes
 * that still await on the server before the page shell renders.
 */
export function AppRoutePulseFallback() {
  return (
    <div
      className="min-h-[45vh] w-full bg-tt-bg px-4 pt-3 sm:px-6 sm:pt-4"
      aria-hidden
    >
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <div className="flex h-12 items-center gap-3 border-b border-tt-line/50 pb-3">
          <div className="h-8 w-28 animate-pulse rounded-tt-md bg-tt-bg-soft" />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden h-8 w-20 animate-pulse rounded-full bg-tt-bg-soft sm:block" />
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-tt-bg-soft" />
          </div>
        </div>
        <div className="h-36 animate-pulse rounded-tt-xl bg-tt-bg-soft sm:h-40" />
        <div className="h-44 animate-pulse rounded-tt-lg bg-tt-bg-soft/90 sm:h-52" />
      </div>
    </div>
  );
}
