import type { LiveWaitCurrentApiResponse } from "@/lib/live-wait/public-types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";

export const LIVE_WAIT_CURRENT_CACHE_CONTROL = "private, max-age=0, s-maxage=45";
export const MAX_LIVE_WAIT_PARKS = 12;

const QUEUE_TIMES_PROVIDER = "queue_times";

function createLiveWaitPublicClient() {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) {
    throw new Error("Missing Supabase URL or anon key for live wait reads.");
  }

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function normaliseLiveWaitParkIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_LIVE_WAIT_PARKS,
  );
}

/**
 * Queue-Times `external_park_id` values for the given TripTiles `park_id`s, plus
 * a map to backfill `park_id` on unmapped `live_wait_current` rows (those rows
 * have `park_id` null until ride-level mappings exist).
 *
 * Tries `live_wait_provider_mappings` park-link rows first (`attraction_id` null).
 * Falls back to distinct pairs from `live_wait_current` when that query is
 * empty or not permitted for the caller (e.g. anon has no SELECT on mappings).
 */
async function resolveQueueTimesExternalParkIdsForTripTilesParks(
  supabase: ReturnType<typeof createLiveWaitPublicClient>,
  scopedParkIds: string[],
): Promise<{ externalIds: string[]; externalToParkId: Map<string, string> }> {
  const externalToParkId = new Map<string, string>();
  const externalIds = new Set<string>();

  const { data: mappingRows, error: mappingError } = await supabase
    .from("live_wait_provider_mappings")
    .select("external_park_id, park_id")
    .eq("provider", QUEUE_TIMES_PROVIDER)
    .is("attraction_id", null)
    .in("park_id", scopedParkIds);

  if (!mappingError && mappingRows && mappingRows.length > 0) {
    for (const row of mappingRows as {
      external_park_id?: string | null;
      park_id?: string | null;
    }[]) {
      const ext = String(row.external_park_id ?? "").trim();
      const pid = String(row.park_id ?? "").trim();
      if (!ext || !pid) continue;
      externalIds.add(ext);
      if (!externalToParkId.has(ext)) externalToParkId.set(ext, pid);
    }
  }

  if (externalIds.size === 0) {
    const { data: anchorRows, error: anchorError } = await supabase
      .from("live_wait_current")
      .select("external_park_id, park_id")
      .eq("provider", QUEUE_TIMES_PROVIDER)
      .in("park_id", scopedParkIds)
      .not("park_id", "is", null);

    if (anchorError) {
      throw new Error(anchorError.message);
    }

    for (const row of anchorRows ?? []) {
      const ext = String((row as { external_park_id?: string }).external_park_id ?? "").trim();
      const pid = String((row as { park_id?: string }).park_id ?? "").trim();
      if (!ext || !pid) continue;
      externalIds.add(ext);
      if (!externalToParkId.has(ext)) externalToParkId.set(ext, pid);
    }
  }

  const externalIdsSorted = [...externalIds].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  return { externalIds: externalIdsSorted, externalToParkId };
}

export async function getCurrentLiveWaitsForParks(
  parkIds: string[],
): Promise<LiveWaitCurrentApiResponse> {
  const scopedParkIds = normaliseLiveWaitParkIds(parkIds);
  if (scopedParkIds.length === 0) {
    return { items: [], showQueueTimesAttribution: false };
  }

  const supabase = createLiveWaitPublicClient();

  const { externalIds, externalToParkId } =
    await resolveQueueTimesExternalParkIdsForTripTilesParks(supabase, scopedParkIds);

  if (externalIds.length === 0) {
    return { items: [], showQueueTimesAttribution: false };
  }

  const { data, error } = await supabase
    .from("live_wait_current")
    .select(
      "provider, park_id, attraction_id, external_park_id, external_attraction_id, external_name, wait_minutes, operating_status, is_open, observed_at, fetched_at, stale_after",
    )
    .eq("provider", QUEUE_TIMES_PROVIDER)
    .in("external_park_id", externalIds)
    .limit(800);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map((row) => {
    const item = row as LiveWaitCurrentApiResponse["items"][number];
    if (item.park_id) return item;
    const inferred = externalToParkId.get(String(item.external_park_id ?? "").trim());
    if (!inferred) return item;
    return { ...item, park_id: inferred };
  });
  return {
    items,
    showQueueTimesAttribution: items.some((row) => row.provider === "queue_times"),
  };
}

export async function getLiveWaitCoverageParkIds(): Promise<string[]> {
  const supabase = createLiveWaitPublicClient();
  const { data, error } = await supabase
    .from("live_wait_current")
    .select("park_id")
    .not("park_id", "is", null)
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as { park_id?: string | null }).park_id;
    if (id) ids.add(id);
  }
  return [...ids].sort();
}
