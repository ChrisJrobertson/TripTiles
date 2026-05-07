/** Pulse fallback while the grid / parks / calendar chunk loads (no copy, stable min-heights). */
export function PlannerGridColumnStackSkeleton() {
  return (
    <div
      className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(18rem,20rem)_minmax(0,1fr)] lg:gap-5 xl:gap-6"
      aria-hidden
    >
      <div className="hidden space-y-3 md:block lg:sticky lg:top-20 lg:max-h-[calc(100vh-5rem)] lg:pr-1">
        <div className="h-44 animate-pulse rounded-tt-lg bg-tt-bg-soft/95" />
        <div className="h-64 animate-pulse rounded-tt-lg bg-tt-bg-soft/90" />
      </div>
      <div className="min-w-0 space-y-4">
        <div className="min-h-[min(38vh,24rem)] animate-pulse rounded-tt-lg bg-tt-bg-soft/95" />
        <div className="min-h-40 animate-pulse rounded-tt-lg bg-tt-bg-soft/85" />
      </div>
    </div>
  );
}
