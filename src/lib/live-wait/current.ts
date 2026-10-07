import type { LiveWaitCurrentApiResponse, LiveWaitPublicItem } from "@/lib/live-wait/public-types";
import { classifyFreshness } from "@/lib/park-data/freshness";
import { chooseObservation } from "@/lib/park-data/live-selection";
import { readProviderPolicy } from "@/lib/park-data/registry";
import { PROVIDER_QUEUE_TIMES, PROVIDER_THEMEPARKS_WIKI } from "@/lib/park-data/types";
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

async function resolveExternalParkIds(
  supabase: ReturnType<typeof createLiveWaitPublicClient>,
  provider: string,
  scopedParkIds: string[],
): Promise<{ externalIds: string[]; externalToParkId: Map<string, string> }> {
  const externalToParkId = new Map<string, string>();
  const externalIds = new Set<string>();

  const { data: mappingRows, error: mappingError } = await supabase
    .from("live_wait_provider_mappings")
    .select("external_park_id, park_id")
    .eq("provider", provider)
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

  const { data: parkRows, error: parkError } = await supabase
    .from("live_wait_park_mappings")
    .select("external_park_id, park_id")
    .eq("provider", provider)
    .in("park_id", scopedParkIds);
  if (!parkError) {
    for (const row of parkRows ?? []) {
      const ext = String((row as { external_park_id?: string }).external_park_id ?? "").trim();
      const pid = String((row as { park_id?: string }).park_id ?? "").trim();
      if (!ext || !pid) continue;
      externalIds.add(ext);
      if (!externalToParkId.has(ext)) externalToParkId.set(ext, pid);
    }
  }

  if (externalIds.size === 0) {
    const { data: anchorRows, error: anchorError } = await supabase
      .from("live_wait_current")
      .select("external_park_id, park_id")
      .eq("provider", provider)
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

function emptyLiveResponse(): LiveWaitCurrentApiResponse {
  return {
    items: [],
    showQueueTimesAttribution: false,
    showThemeParksWikiAttribution: false,
  };
}

export async function getCurrentLiveWaitsForParks(
  parkIds: string[],
): Promise<LiveWaitCurrentApiResponse> {
  const scopedParkIds = normaliseLiveWaitParkIds(parkIds);
  if (scopedParkIds.length === 0) return emptyLiveResponse();

  const supabase = createLiveWaitPublicClient();
  const policy = readProviderPolicy();
  const providers = policy.legacySingleProvider
    ? [policy.legacySingleProvider]
    : [policy.primary, policy.fallback].filter((id): id is string => Boolean(id));

  const externalIds = new Set<string>();
  const externalToParkId = new Map<string, string>();
  for (const provider of providers) {
    const resolved = await resolveExternalParkIds(supabase, provider, scopedParkIds);
    for (const id of resolved.externalIds) externalIds.add(id);
    for (const [ext, parkId] of resolved.externalToParkId) {
      externalToParkId.set(`${provider}\t${ext}`, parkId);
    }
  }

  if (externalIds.size === 0) return emptyLiveResponse();

  const { data, error } = await supabase
    .from("live_wait_current")
    .select(
      "provider, park_id, attraction_id, external_park_id, external_attraction_id, external_name, wait_minutes, operating_status, is_open, observed_at, fetched_at, stale_after",
    )
    .in("provider", providers)
    .in("external_park_id", [...externalIds])
    .limit(1600);

  if (error) {
    throw new Error(error.message);
  }

  const now = new Date();
  const hydrated = (data ?? []).map((row) => {
    const item = row as LiveWaitPublicItem;
    if (item.park_id) return item;
    const inferred = externalToParkId.get(
      `${item.provider}\t${String(item.external_park_id ?? "").trim()}`,
    );
    return inferred ? { ...item, park_id: inferred } : item;
  });

  const groups = new Map<string, LiveWaitPublicItem[]>();
  for (const item of hydrated) {
    const key = item.attraction_id
      ? `attraction:${item.attraction_id}`
      : `external:${item.provider}:${item.external_park_id}:${item.external_attraction_id}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const items: LiveWaitPublicItem[] = [];
  for (const group of groups.values()) {
    const ranked = group.map((item) => ({
      ...item,
      freshness: classifyFreshness({
        observedAt: item.observed_at,
        fetchedAt: item.fetched_at,
        staleAfter: item.stale_after,
        now,
      }),
      observedAt: item.observed_at,
      waitMinutes: item.wait_minutes,
      isOpen: item.is_open,
      operatingStatus: item.operating_status,
    }));
    const chosen = chooseObservation(
      ranked,
      policy.legacySingleProvider ?? policy.primary,
      policy.legacySingleProvider ? null : policy.fallback,
    );
    if (!chosen.row) continue;
    items.push({ ...chosen.row, selection_reason: chosen.reason });
  }

  return {
    items,
    showQueueTimesAttribution: items.some((row) => row.provider === PROVIDER_QUEUE_TIMES),
    showThemeParksWikiAttribution: items.some((row) => row.provider === PROVIDER_THEMEPARKS_WIKI),
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
