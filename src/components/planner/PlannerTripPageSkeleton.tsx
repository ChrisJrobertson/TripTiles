/**
 * Route-level fallback while trip planner server data resolves.
 * Mirrors PlannerClient shell heights to limit layout shift (no spinners / no "Loading" copy).
 */
export function PlannerTripPageSkeleton() {
  return (
    <div
      className="min-h-screen bg-tt-bg pb-28 pt-2 text-tt-ink lg:pb-16"
      aria-hidden
    >
      <div className="border-b border-tt-line/60 bg-tt-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
          <div className="h-8 w-32 animate-pulse rounded-tt-md bg-tt-bg-soft" />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden h-8 w-[4.5rem] animate-pulse rounded-full bg-tt-bg-soft sm:block" />
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-tt-bg-soft" />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-screen-2xl px-4 pt-2 sm:px-6 lg:px-8">
        <div className="h-4 w-full max-w-md animate-pulse rounded-tt-md bg-tt-bg-soft/80" />
      </div>
      <main className="mx-auto w-full max-w-screen-2xl px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
        <div className="relative overflow-hidden rounded-tt-xl border border-tt-line bg-gradient-to-br from-tt-surface via-tt-surface-warm to-tt-bg-soft px-4 py-4 shadow-tt-md sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-tt-bg-soft" />
                <div className="h-9 min-w-[12rem] max-w-[80%] flex-1 animate-pulse rounded-tt-md bg-tt-bg-soft" />
              </div>
              <div className="h-4 w-3/4 max-w-sm animate-pulse rounded-tt-md bg-tt-bg-soft" />
              <div className="flex flex-wrap gap-2">
                <div className="h-8 w-24 animate-pulse rounded-full bg-tt-bg-soft" />
                <div className="h-8 w-28 animate-pulse rounded-full bg-tt-bg-soft" />
                <div className="h-8 w-20 animate-pulse rounded-full bg-tt-bg-soft" />
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:max-w-xs lg:w-64">
              <div className="h-3 w-24 animate-pulse rounded bg-tt-bg-soft" />
              <div className="h-11 w-full animate-pulse rounded-tt-md bg-tt-bg-soft" />
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <div className="h-9 w-32 animate-pulse rounded-full bg-tt-bg-soft" />
                <div className="h-8 w-20 animate-pulse rounded-tt-md bg-tt-bg-soft" />
              </div>
            </div>
          </div>
          <div className="mt-4 h-11 w-full max-w-xl animate-pulse rounded-tt-md bg-tt-bg-soft" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
          <div className="space-y-4">
            <div className="min-h-[12rem] animate-pulse rounded-tt-lg bg-tt-bg-soft/95 md:min-h-[14rem]" />
            <div className="min-h-[min(42vh,22rem)] animate-pulse rounded-tt-lg bg-tt-bg-soft/90" />
          </div>
          <div className="min-h-[10rem] animate-pulse rounded-tt-lg bg-tt-bg-soft/90 lg:min-h-[min(42vh,22rem)]" />
        </div>
      </main>
    </div>
  );
}
