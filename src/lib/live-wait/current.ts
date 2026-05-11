import type { LiveWaitCurrentApiResponse } from "@/lib/live-wait/public-types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";

export const LIVE_WAIT_CURRENT_CACHE_CONTROL = "private, max-age=0, s-maxage=45";
export const MAX_LIVE_WAIT_PARKS = 12;

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

export async function getCurrentLiveWaitsForParks(
  parkIds: string[],
): Promise<LiveWaitCurrentApiResponse> {
  const scopedParkIds = normaliseLiveWaitParkIds(parkIds);
  if (scopedParkIds.length === 0) {
    return { items: [], showQueueTimesAttribution: false };
  }

  const supabase = createLiveWaitPublicClient();
  const { data, error } = await supabase
    .from("live_wait_current")
    .select(
      "provider, park_id, attraction_id, external_park_id, external_attraction_id, external_name, wait_minutes, operating_status, is_open, observed_at, fetched_at, stale_after",
    )
    .in("park_id", scopedParkIds)
    .limit(800);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []) as LiveWaitCurrentApiResponse["items"];
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
