import {
  TodayAtParkClient,
  type TodayAtParkOption,
  type TodayAtParkRide,
  type TodayAtParkSort,
} from "@/components/live-wait/TodayAtParkClient";
import { getAttractionsForParksPublic } from "@/lib/db/attractions";
import { getParksByIds } from "@/lib/db/parks";
import { getAllRegions } from "@/lib/db/regions";
import {
  getCurrentLiveWaitsForParks,
  getLiveWaitCoverageParkIds,
} from "@/lib/live-wait/current";
import type { LiveWaitCurrentApiResponse } from "@/lib/live-wait/public-types";
import type { Park } from "@/lib/types";
import type { Attraction } from "@/types/attractions";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Today at Park — Live wait times | TripTiles",
  description:
    "See current posted ride waits and operating status for same-day park visits.",
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseSort(value: string | null): TodayAtParkSort {
  if (
    value === "shortest" ||
    value === "longest" ||
    value === "status" ||
    value === "alphabetical"
  ) {
    return value;
  }
  return "shortest";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function optionFromPark(park: Park): TodayAtParkOption {
  return {
    id: park.id,
    name: park.name,
    park_group: park.park_group,
    region_ids: park.region_ids,
  };
}

function buildRideRows(
  liveData: LiveWaitCurrentApiResponse,
  attractions: Attraction[],
): TodayAtParkRide[] {
  const attractionById = new Map(attractions.map((attraction) => [attraction.id, attraction]));

  return liveData.items
    .map((row): TodayAtParkRide => {
      const attraction = row.attraction_id ? attractionById.get(row.attraction_id) : null;
      return {
        id:
          row.attraction_id ??
          `${row.provider}:${row.external_park_id}:${row.external_attraction_id}`,
        name: attraction?.name ?? row.external_name ?? "Unnamed ride",
        externalName: row.external_name,
        wait_minutes: row.wait_minutes,
        operating_status: row.operating_status,
        is_open: row.is_open,
        observed_at: row.observed_at,
        fetched_at: row.fetched_at,
        stale_after: row.stale_after,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default async function TodayAtParkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const requestedParkId = firstParam(sp.parkId);
  const requestedRegionId = firstParam(sp.regionId);
  const initialSort = parseSort(firstParam(sp.sort));

  let loadError: string | null = null;
  let coverageParkIds: string[] = [];
  try {
    coverageParkIds = await getLiveWaitCoverageParkIds();
  } catch (error) {
    loadError = errorMessage(error);
  }

  const parkIdsToLoad = [
    ...new Set([...(requestedParkId ? [requestedParkId] : []), ...coverageParkIds]),
  ];

  let parks: Park[] = [];
  let regions: { id: string; name: string }[] = [];
  try {
    const [parkRows, regionRows] = await Promise.all([
      getParksByIds(parkIdsToLoad),
      getAllRegions(),
    ]);
    parks = parkRows;
    regions = regionRows.map((region) => ({
      id: region.id,
      name: region.name || region.short_name || region.id,
    }));
  } catch (error) {
    loadError = loadError ?? errorMessage(error);
  }

  const regionNameById = new Map(regions.map((region) => [region.id, region.name]));
  const regionIdsWithCoverage = new Set<string>();
  for (const park of parks) {
    for (const regionId of park.region_ids) {
      if (regionNameById.has(regionId)) regionIdsWithCoverage.add(regionId);
    }
  }

  const regionOptions = [...regionIdsWithCoverage]
    .map((regionId) => ({
      id: regionId,
      name: regionNameById.get(regionId) ?? regionId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedRegionId =
    requestedRegionId && requestedRegionId !== "all" && regionIdsWithCoverage.has(requestedRegionId)
      ? requestedRegionId
      : null;
  const parksForSelectedRegion = selectedRegionId
    ? parks.filter((park) => park.region_ids.includes(selectedRegionId))
    : parks;
  const selectedParkId =
    requestedParkId && parksForSelectedRegion.some((park) => park.id === requestedParkId)
      ? requestedParkId
      : null;

  let liveData: LiveWaitCurrentApiResponse = {
    items: [],
    showQueueTimesAttribution: false,
  };
  let attractions: Attraction[] = [];

  if (selectedParkId) {
    try {
      const [waits, attractionRows] = await Promise.all([
        getCurrentLiveWaitsForParks([selectedParkId]),
        getAttractionsForParksPublic([selectedParkId]),
      ]);
      liveData = waits;
      attractions = attractionRows;
    } catch (error) {
      loadError = loadError ?? errorMessage(error);
    }
  }

  const parkOptions = parksForSelectedRegion.map(optionFromPark);

  const selectedParkName =
    parks.find((park) => park.id === selectedParkId)?.name ??
    (selectedParkId ? "Selected park" : null);

  return (
    <main className="flex-1">
      <TodayAtParkClient
        parks={parkOptions}
        allParks={parks.map(optionFromPark)}
        regions={regionOptions}
        selectedRegionId={selectedRegionId}
        selectedParkId={selectedParkId}
        selectedParkName={selectedParkName}
        rides={buildRideRows(liveData, attractions)}
        showAttribution={liveData.showQueueTimesAttribution}
        loadError={loadError}
        initialSort={initialSort}
        generatedAtIso={new Date().toISOString()}
      />
    </main>
  );
}
