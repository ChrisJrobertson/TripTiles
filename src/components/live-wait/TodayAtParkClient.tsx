"use client";

import { LiveWaitAttributionFooter } from "@/components/live-wait/LiveWaitAttributionFooter";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { minutesBetween } from "@/lib/live-wait/display-format";
import type { LiveWaitOperatingStatus } from "@/types/live-wait";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type TodayAtParkSort = "shortest" | "longest" | "status" | "alphabetical";

export type TodayAtParkOption = {
  id: string;
  name: string;
  park_group: string;
  region_ids: string[];
};

export type TodayAtParkRegionOption = {
  id: string;
  name: string;
};

export type TodayAtParkRide = {
  id: string;
  name: string;
  externalName: string | null;
  wait_minutes: number | null;
  operating_status: LiveWaitOperatingStatus;
  is_open: boolean;
  observed_at: string;
  fetched_at: string;
  stale_after: string;
};

type Props = {
  parks: TodayAtParkOption[];
  allParks: TodayAtParkOption[];
  regions: TodayAtParkRegionOption[];
  selectedRegionId: string | null;
  selectedParkId: string | null;
  selectedParkName: string | null;
  rides: TodayAtParkRide[];
  showAttribution: boolean;
  loadError: string | null;
  initialSort: TodayAtParkSort;
  generatedAtIso: string;
};

const SORT_LABELS: Record<TodayAtParkSort, string> = {
  shortest: "Shortest wait",
  longest: "Longest wait",
  status: "Status",
  alphabetical: "A-Z",
};

function isRowStale(row: TodayAtParkRide, nowIso: string): boolean {
  const staleAt = new Date(row.stale_after).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(staleAt) || Number.isNaN(now)) return false;
  return staleAt < now;
}

function freshnessLabel(row: TodayAtParkRide, nowIso: string): string {
  const mins = minutesBetween(row.observed_at, nowIso);
  const unit = mins === 1 ? "min" : "mins";
  return isRowStale(row, nowIso)
    ? `Stale · updated ${mins} ${unit} ago`
    : `Updated ${mins} ${unit} ago`;
}

function statusLabel(row: TodayAtParkRide): string {
  if (row.operating_status === "temporarily_closed") return "Temporarily closed";
  if (row.operating_status === "down") return "Down";
  if (row.operating_status === "refurb") return "Closed";
  if (!row.is_open || row.operating_status === "closed") return "Closed";
  if (row.wait_minutes == null) return "Wait unavailable";
  return "Open";
}

function statusVariant(row: TodayAtParkRide): "success" | "warning" | "danger" | "default" {
  if (row.is_open && row.operating_status === "open" && row.wait_minutes != null) {
    return "success";
  }
  if (row.operating_status === "temporarily_closed" || row.operating_status === "down") {
    return "warning";
  }
  if (!row.is_open || row.operating_status === "closed" || row.operating_status === "refurb") {
    return "danger";
  }
  return "default";
}

function statusRank(row: TodayAtParkRide): number {
  if (row.is_open && row.operating_status === "open" && row.wait_minutes != null) return 0;
  if (row.is_open && row.operating_status === "open") return 1;
  if (row.operating_status === "temporarily_closed" || row.operating_status === "down") return 2;
  if (!row.is_open || row.operating_status === "closed" || row.operating_status === "refurb") return 3;
  return 4;
}

function sortRows(rows: TodayAtParkRide[], sort: TodayAtParkSort): TodayAtParkRide[] {
  return [...rows].sort((a, b) => {
    if (sort === "alphabetical") return a.name.localeCompare(b.name);
    if (sort === "status") {
      return statusRank(a) - statusRank(b) || a.name.localeCompare(b.name);
    }
    if (sort === "shortest") {
      return (
        (a.wait_minutes ?? Number.POSITIVE_INFINITY) -
          (b.wait_minutes ?? Number.POSITIVE_INFINITY) ||
        statusRank(a) - statusRank(b) ||
        a.name.localeCompare(b.name)
      );
    }
    return (
      (b.wait_minutes ?? Number.NEGATIVE_INFINITY) -
        (a.wait_minutes ?? Number.NEGATIVE_INFINITY) ||
      statusRank(a) - statusRank(b) ||
      a.name.localeCompare(b.name)
    );
  });
}

function latestObservedAt(rows: TodayAtParkRide[]): string | null {
  let latest = 0;
  for (const row of rows) {
    const t = new Date(row.observed_at).getTime();
    if (!Number.isNaN(t) && t > latest) latest = t;
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}

function RideSection({
  title,
  rows,
  nowIso,
}: {
  title: string;
  rows: TodayAtParkRide[];
  nowIso: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-tt-ink-muted">
        {title}
      </h2>
      <div className="space-y-2">
        {rows.map((row) => (
          <Card
            key={row.id}
            className="flex items-center justify-between gap-3 p-3 sm:p-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-sans text-sm font-semibold text-tt-ink sm:text-base">
                  {row.name}
                </h3>
                <Badge variant={statusVariant(row)}>{statusLabel(row)}</Badge>
              </div>
              <p className="mt-1 font-sans text-xs text-tt-ink-muted">
                {freshnessLabel(row, nowIso)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {row.wait_minutes == null ? (
                <>
                  <p className="font-heading text-2xl font-semibold text-tt-ink-muted">
                    --
                  </p>
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-tt-ink-muted">
                    No wait
                  </p>
                </>
              ) : (
                <>
                  <p className="font-heading text-3xl font-semibold text-tt-royal">
                    {row.wait_minutes}
                  </p>
                  <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-tt-ink-muted">
                    min
                  </p>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function TodayAtParkClient({
  parks,
  allParks,
  regions,
  selectedRegionId,
  selectedParkId,
  selectedParkName,
  rides,
  showAttribution,
  loadError,
  initialSort,
  generatedAtIso,
}: Props) {
  const router = useRouter();
  const [sort, setSort] = useState<TodayAtParkSort>(initialSort);

  const sortedRows = useMemo(() => sortRows(rides, sort), [rides, sort]);
  const openWithWait = sortedRows.filter(
    (row) => row.is_open && row.operating_status === "open" && row.wait_minutes != null,
  );
  const knownNoWait = sortedRows.filter(
    (row) => row.is_open && row.operating_status === "open" && row.wait_minutes == null,
  );
  const unavailable = sortedRows.filter(
    (row) => !row.is_open || row.operating_status !== "open",
  );
  const staleCount = rides.filter((row) => isRowStale(row, generatedAtIso)).length;
  const latest = latestObservedAt(rides);

  function buildUrl(params: { regionId?: string | null; parkId?: string | null }) {
    const next = new URLSearchParams();
    if (params.regionId) next.set("regionId", params.regionId);
    if (params.parkId) next.set("parkId", params.parkId);
    if (sort !== "shortest") next.set("sort", sort);
    const qs = next.toString();
    return qs ? `/today-at-park?${qs}` : "/today-at-park";
  }

  function changeRegion(nextRegionId: string) {
    const regionId = nextRegionId && nextRegionId !== "all" ? nextRegionId : null;
    const firstParkInRegion = regionId
      ? allParks.find((park) => park.region_ids.includes(regionId))?.id ?? null
      : null;
    router.push(buildUrl({ regionId, parkId: firstParkInRegion }));
  }

  function changePark(nextParkId: string) {
    router.push(buildUrl({ regionId: selectedRegionId, parkId: nextParkId || null }));
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-tt-royal">
          Live park operations
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-semibold text-tt-ink sm:text-4xl">
              Today at Park
            </h1>
            <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-tt-ink-muted sm:text-base">
              Current posted standby waits and ride status for same-day planning.
              No forecasts, no Smart Plan changes.
            </p>
          </div>
          <Button variant="secondary" onClick={() => router.refresh()}>
            Refresh
          </Button>
        </div>
      </header>

      <Card className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px]">
        <label className="flex flex-col gap-2 font-sans text-sm font-semibold text-tt-ink">
          Region
          <select
            value={selectedRegionId ?? "all"}
            onChange={(event) => changeRegion(event.target.value)}
            className="min-h-11 rounded-tt-md border border-tt-line bg-white px-3 font-sans text-sm font-medium text-tt-ink shadow-tt-sm"
          >
            <option value="all">All regions</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 font-sans text-sm font-semibold text-tt-ink">
          Park
          <select
            value={selectedParkId ?? ""}
            onChange={(event) => changePark(event.target.value)}
            className="min-h-11 rounded-tt-md border border-tt-line bg-white px-3 font-sans text-sm font-medium text-tt-ink shadow-tt-sm"
          >
            <option value="">Choose a park</option>
            {parks.map((park) => (
              <option key={park.id} value={park.id}>
                {park.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 font-sans text-sm font-semibold text-tt-ink">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as TodayAtParkSort)}
            className="min-h-11 rounded-tt-md border border-tt-line bg-white px-3 font-sans text-sm font-medium text-tt-ink shadow-tt-sm"
          >
            {(Object.keys(SORT_LABELS) as TodayAtParkSort[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
      </Card>

      {selectedParkName && latest ? (
        <div className="rounded-tt-lg border border-tt-line-soft bg-white/80 px-4 py-3 font-sans text-sm text-tt-ink-muted">
          <span className="font-semibold text-tt-ink">{selectedParkName}</span>{" "}
          last updated {minutesBetween(latest, generatedAtIso)} mins ago.
        </div>
      ) : null}

      {staleCount > 0 ? (
        <Card className="border-tt-warning/25 bg-tt-warning-soft p-4 text-sm text-tt-warning">
          {staleCount === rides.length
            ? "This park's live data looks stale. Treat these waits as a guide only."
            : "Some ride rows are stale. Check the updated time before relying on them."}
        </Card>
      ) : null}

      {loadError ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Live waits could not be loaded: {loadError}
        </Card>
      ) : null}

      {!selectedParkId ? (
        <EmptyState
          title="Choose a park"
          description={
            parks.length > 0
              ? "Pick a park with live coverage to see current posted waits."
              : "No live wait coverage is available yet."
          }
        />
      ) : rides.length === 0 && !loadError ? (
        <EmptyState
          title="No live waits yet"
          description="This park does not have current live wait rows available. Try refreshing later or choose another park."
        />
      ) : (
        <div className="space-y-6">
          <RideSection
            title="Open rides with waits"
            rows={openWithWait}
            nowIso={generatedAtIso}
          />
          <RideSection
            title="Open, wait unavailable"
            rows={knownNoWait}
            nowIso={generatedAtIso}
          />
          <RideSection
            title="Closed or down"
            rows={unavailable}
            nowIso={generatedAtIso}
          />
        </div>
      )}

      <LiveWaitAttributionFooter visible={showAttribution} />
    </div>
  );
}
