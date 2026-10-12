import { eachDateKeyInRange } from "@/lib/date-helpers";
import { readProviderPolicy } from "@/lib/park-data/registry";
import {
  resolveOperatingWindow,
  type CatalogueHours,
  type NormalisedScheduleEntry,
  type OperatingWindowResolution,
  type OperatingWindowSource,
} from "@/lib/park-data/schedule";
import {
  primaryParkForDayWindow,
  type PostedHoursHint,
} from "@/lib/planner/day-times";
import type { Park, Trip } from "@/lib/types";

type QueryClient = {
  from: (table: string) => {
    select: (columns: string) => unknown;
  };
};

const SCHEDULE_COLUMNS =
  "park_id, provider, operating_date, opens_at, closes_at, schedule_kind, timezone, provenance_kind, observed_at, fetched_at, stale_after, description";

function asRows(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

function scheduleFromRow(row: Record<string, unknown>, fallbackDate: string): NormalisedScheduleEntry {
  return {
    parkId: typeof row.park_id === "string" ? row.park_id : null,
    provider: String(row.provider ?? ""),
    operatingDate: String(row.operating_date ?? fallbackDate),
    opensAt: typeof row.opens_at === "string" ? row.opens_at : null,
    closesAt: typeof row.closes_at === "string" ? row.closes_at : null,
    scheduleKind: (row.schedule_kind as NormalisedScheduleEntry["scheduleKind"]) ?? "operating",
    timezone: typeof row.timezone === "string" ? row.timezone : null,
    provenanceKind:
      (row.provenance_kind as NormalisedScheduleEntry["provenanceKind"]) ?? "PROVIDER_OBSERVATION",
    observedAt: typeof row.observed_at === "string" ? row.observed_at : null,
    fetchedAt: typeof row.fetched_at === "string" ? row.fetched_at : null,
    staleAfter: typeof row.stale_after === "string" ? row.stale_after : null,
    description: typeof row.description === "string" ? row.description : null,
  };
}

function catalogueFromRow(row: Record<string, unknown>): CatalogueHours {
  return {
    parkId: String(row.id ?? ""),
    opensAt: typeof row.opens_at === "string" ? row.opens_at : null,
    closesAt: typeof row.closes_at === "string" ? row.closes_at : null,
    hoursKnown: row.hours_known === true,
  };
}

async function readSchedules(
  supabase: QueryClient,
  parkIds: string[],
  start: string,
  end: string,
): Promise<NormalisedScheduleEntry[]> {
  const query = supabase.from("park_operating_schedules").select(SCHEDULE_COLUMNS) as {
    in: (column: string, values: string[]) => {
      gte: (column: string, value: string) => {
        lte: (column: string, value: string) => Promise<{
          data: unknown;
          error: { message: string } | null;
        }>;
      };
    };
  };
  const { data, error } = await query.in("park_id", parkIds).gte("operating_date", start).lte("operating_date", end);
  if (error) return [];
  return asRows(data).map((row) => scheduleFromRow(row, start));
}

async function readCatalogues(
  supabase: QueryClient,
  parkIds: string[],
): Promise<CatalogueHours[]> {
  const query = supabase.from("parks").select("id, opens_at, closes_at, hours_known") as {
    in: (column: string, values: string[]) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await query.in("id", parkIds);
  if (error) return [];
  return asRows(data).map(catalogueFromRow);
}

export function preferredScheduleProvider(): string {
  const policy = readProviderPolicy();
  return policy.legacySingleProvider ?? policy.primary;
}

export function hoursKindLabel(source: OperatingWindowSource): "Posted" | "Stored" | "TYPICAL" | "ESTIMATE" | "Unknown" {
  if (source === "posted_schedule") return "Posted";
  if (source === "stored_schedule") return "Stored";
  if (source === "catalogue_hours") return "TYPICAL";
  if (source === "fallback_assumption") return "ESTIMATE";
  return "Unknown";
}

export function providerDisplayName(provider: string | null | undefined): string | null {
  if (provider === "themeparks_wiki") return "ThemeParks.wiki";
  if (provider === "queue_times") return "Queue-Times";
  if (!provider) return null;
  return provider;
}

export function hintFromResolution(resolution: OperatingWindowResolution): PostedHoursHint | null {
  if (!resolution.open || !resolution.close) return null;
  if (resolution.source === "posted_schedule" || resolution.source === "stored_schedule") {
    return {
      open: resolution.open,
      close: resolution.close,
      source: resolution.source,
    };
  }
  if (resolution.source === "catalogue_hours") {
    return {
      open: resolution.open,
      close: resolution.close,
      source: "catalogue",
    };
  }
  return null;
}

export async function loadResolutionsForParks(
  supabase: QueryClient,
  parkIds: string[],
  start: string,
  end: string,
): Promise<Map<string, OperatingWindowResolution>> {
  const ids = [...new Set(parkIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, OperatingWindowResolution>();
  if (ids.length === 0) return out;
  const [schedules, catalogues] = await Promise.all([
    readSchedules(supabase, ids, start, end),
    readCatalogues(supabase, ids),
  ]);
  const preferred = preferredScheduleProvider();
  const dates = eachDateKeyInRange(start, end);
  for (const parkId of ids) {
    const catalogue = catalogues.find((row) => row.parkId === parkId) ?? null;
    const parkSchedules = schedules.filter((row) => row.parkId === parkId);
    for (const date of dates) {
      out.set(
        `${parkId}|${date}`,
        resolveOperatingWindow({
          date,
          schedules: parkSchedules,
          catalogue,
          preferredProvider: preferred,
        }),
      );
    }
  }
  return out;
}

export async function postedHintsForTrip(
  supabase: QueryClient,
  trip: Trip,
  parkById: ReadonlyMap<string, Park>,
): Promise<Map<string, PostedHoursHint>> {
  const dates = eachDateKeyInRange(trip.start_date, trip.end_date);
  const parkIds = [
    ...new Set(
      dates
        .map((date) => primaryParkForDayWindow(trip, date, parkById)?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const hints = new Map<string, PostedHoursHint>();
  if (parkIds.length === 0 || dates.length === 0) return hints;
  const resolutions = await loadResolutionsForParks(
    supabase,
    parkIds,
    dates[0]!,
    dates[dates.length - 1]!,
  );
  for (const date of dates) {
    const park = primaryParkForDayWindow(trip, date, parkById);
    if (!park) continue;
    const resolution = resolutions.get(`${park.id}|${date}`);
    const hint = resolution ? hintFromResolution(resolution) : null;
    if (hint) hints.set(date, hint);
  }
  return hints;
}

export async function postedHintForPrimaryPark(
  supabase: QueryClient,
  trip: Trip,
  dateKey: string,
  parkById: ReadonlyMap<string, Park>,
): Promise<PostedHoursHint | null> {
  const park = primaryParkForDayWindow(trip, dateKey, parkById);
  if (!park) return null;
  const resolutions = await loadResolutionsForParks(supabase, [park.id], dateKey, dateKey);
  const resolution = resolutions.get(`${park.id}|${dateKey}`);
  return resolution ? hintFromResolution(resolution) : null;
}
