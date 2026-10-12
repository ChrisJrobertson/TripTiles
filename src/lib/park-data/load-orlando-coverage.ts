import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildOrlandoCoverageReport,
  type AttractionMappingRow,
  type CatalogueParkSnapshot,
  type FetchLogRow,
  type LiveObservationRow,
  type OrlandoParkReport,
  type ParkMappingRow,
  type ScheduleCoverageRow,
} from "@/lib/park-data/orlando-report";
import { ORLANDO_PARK_IDENTITIES } from "@/lib/park-data/orlando-parks";
import { readProviderPolicy } from "@/lib/park-data/registry";

const PARK_IDS = ORLANDO_PARK_IDENTITIES.map((park) => park.parkId);

function todayInNewYork(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function loadOrlandoCoverage(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<{ report: { parks: OrlandoParkReport[]; summary: string }; warnings: string[] }> {
  const warnings: string[] = [];
  const policy = readProviderPolicy();

  const catalogues = new Map<string, CatalogueParkSnapshot>();
  for (const park of ORLANDO_PARK_IDENTITIES) {
    catalogues.set(park.parkId, {
      parkId: park.parkId,
      name: park.canonicalName,
      latitude: null,
      longitude: null,
      officialUrl: null,
      timezoneSupported: false,
      attractionCount: 0,
      attractionsWithOfficialUrl: 0,
      attractionsWithHeight: 0,
      attractionsWithDuration: 0,
      attractionsWithThrill: 0,
      attractionsWithCategory: 0,
      attractionsWithSkipLine: 0,
      attractionsVerifiedOrPartial: 0,
      attractionsWithEvidence: 0,
      attractionsWithVerifiedAt: 0,
      indoorKnownCount: 0,
    });
  }

  const parksResult = await supabase
    .from("parks")
    .select("id, name, latitude, longitude, official_url")
    .in("id", PARK_IDS);
  if (parksResult.error) warnings.push(`parks: ${parksResult.error.message}`);
  for (const row of parksResult.data ?? []) {
    const record = row as Record<string, unknown>;
    const id = String(record.id ?? "");
    const snap = catalogues.get(id);
    if (!snap) continue;
    snap.name = typeof record.name === "string" ? record.name : snap.name;
    snap.latitude = typeof record.latitude === "number" ? record.latitude : null;
    snap.longitude = typeof record.longitude === "number" ? record.longitude : null;
    snap.officialUrl = typeof record.official_url === "string" ? record.official_url : null;
  }

  const attractionsResult = await supabase
    .from("attractions")
    .select(
      "park_id, official_url, height_requirement_cm, duration_minutes, thrill_level, category, skip_line_system, verification_status, verified_at, source_url",
    )
    .in("park_id", PARK_IDS)
    .limit(5000);
  if (attractionsResult.error) warnings.push(`attractions: ${attractionsResult.error.message}`);
  for (const row of attractionsResult.data ?? []) {
    const record = row as Record<string, unknown>;
    const snap = catalogues.get(String(record.park_id ?? ""));
    if (!snap) continue;
    snap.attractionCount += 1;
    if (typeof record.official_url === "string" && record.official_url) snap.attractionsWithOfficialUrl += 1;
    if (typeof record.height_requirement_cm === "number") snap.attractionsWithHeight += 1;
    if (typeof record.duration_minutes === "number") snap.attractionsWithDuration += 1;
    if (typeof record.thrill_level === "string" && record.thrill_level) snap.attractionsWithThrill += 1;
    if (typeof record.category === "string" && record.category) snap.attractionsWithCategory += 1;
    if (typeof record.skip_line_system === "string" && record.skip_line_system) {
      snap.attractionsWithSkipLine += 1;
    }
    if (record.verification_status === "verified" || record.verification_status === "partial") {
      snap.attractionsVerifiedOrPartial += 1;
    }
    if (
      (typeof record.source_url === "string" && record.source_url) ||
      (typeof record.official_url === "string" && record.official_url)
    ) {
      snap.attractionsWithEvidence += 1;
    }
    if (typeof record.verified_at === "string" && record.verified_at) snap.attractionsWithVerifiedAt += 1;
  }

  const parkMappings: ParkMappingRow[] = [];
  const parkMapResult = await supabase
    .from("live_wait_park_mappings")
    .select("park_id, provider, external_park_id, match_status")
    .in("park_id", PARK_IDS)
    .limit(2000);
  if (parkMapResult.error) warnings.push(`park mappings: ${parkMapResult.error.message}`);
  for (const row of parkMapResult.data ?? []) {
    const record = row as Record<string, unknown>;
    parkMappings.push({
      parkId: typeof record.park_id === "string" ? record.park_id : null,
      provider: String(record.provider ?? ""),
      externalParkId: String(record.external_park_id ?? ""),
      matchStatus: typeof record.match_status === "string" ? record.match_status : null,
    });
  }

  const attractionMappings: AttractionMappingRow[] = [];
  const attractionMapResult = await supabase
    .from("live_wait_provider_mappings")
    .select("park_id, provider, attraction_id, external_park_id, external_attraction_id, match_status")
    .in("park_id", PARK_IDS)
    .limit(5000);
  if (attractionMapResult.error) warnings.push(`attraction mappings: ${attractionMapResult.error.message}`);
  for (const row of attractionMapResult.data ?? []) {
    const record = row as Record<string, unknown>;
    attractionMappings.push({
      parkId: typeof record.park_id === "string" ? record.park_id : null,
      provider: String(record.provider ?? ""),
      attractionId: typeof record.attraction_id === "string" ? record.attraction_id : null,
      externalParkId: String(record.external_park_id ?? ""),
      externalAttractionId: String(record.external_attraction_id ?? ""),
      matchStatus: typeof record.match_status === "string" ? record.match_status : null,
    });
  }

  const live: LiveObservationRow[] = [];
  const liveResult = await supabase
    .from("live_wait_current")
    .select(
      "provider, park_id, attraction_id, external_park_id, external_attraction_id, external_name, observed_at, fetched_at, stale_after",
    )
    .in("park_id", PARK_IDS)
    .limit(5000);
  if (liveResult.error) warnings.push(`live waits: ${liveResult.error.message}`);
  for (const row of liveResult.data ?? []) {
    const record = row as Record<string, unknown>;
    live.push({
      provider: String(record.provider ?? ""),
      parkId: typeof record.park_id === "string" ? record.park_id : null,
      attractionId: typeof record.attraction_id === "string" ? record.attraction_id : null,
      externalParkId: String(record.external_park_id ?? ""),
      externalAttractionId: String(record.external_attraction_id ?? ""),
      externalName: typeof record.external_name === "string" ? record.external_name : null,
      observedAt: typeof record.observed_at === "string" ? record.observed_at : null,
      fetchedAt: typeof record.fetched_at === "string" ? record.fetched_at : null,
      staleAfter: typeof record.stale_after === "string" ? record.stale_after : null,
    });
  }

  const schedules: ScheduleCoverageRow[] = [];
  const scheduleResult = await supabase
    .from("park_operating_schedules")
    .select("park_id, provider, operating_date, schedule_kind, fetched_at, stale_after")
    .in("park_id", PARK_IDS)
    .limit(4000);
  if (scheduleResult.error) warnings.push(`schedules: ${scheduleResult.error.message}`);
  for (const row of scheduleResult.data ?? []) {
    const record = row as Record<string, unknown>;
    schedules.push({
      parkId: typeof record.park_id === "string" ? record.park_id : null,
      provider: String(record.provider ?? ""),
      operatingDate: String(record.operating_date ?? ""),
      scheduleKind: String(record.schedule_kind ?? ""),
      fetchedAt: typeof record.fetched_at === "string" ? record.fetched_at : null,
      staleAfter: typeof record.stale_after === "string" ? record.stale_after : null,
    });
  }

  const fetchLog: FetchLogRow[] = [];
  const logResult = await supabase
    .from("provider_fetch_log")
    .select("provider, park_id, external_park_id, operation, ok, error_message, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(200);
  if (logResult.error) warnings.push(`fetch log: ${logResult.error.message}`);
  for (const row of logResult.data ?? []) {
    const record = row as Record<string, unknown>;
    fetchLog.push({
      provider: String(record.provider ?? ""),
      parkId: typeof record.park_id === "string" ? record.park_id : null,
      externalParkId: typeof record.external_park_id === "string" ? record.external_park_id : null,
      operation: String(record.operation ?? ""),
      ok: record.ok === true,
      errorMessage: typeof record.error_message === "string" ? record.error_message : null,
      fetchedAt: String(record.fetched_at ?? ""),
    });
  }

  const report = buildOrlandoCoverageReport({
    now,
    today: todayInNewYork(now),
    primaryProvider: policy.legacySingleProvider ?? policy.primary,
    fallbackProvider: policy.legacySingleProvider ? null : policy.fallback,
    catalogues: [...catalogues.values()],
    parkMappings,
    attractionMappings,
    live,
    schedules,
    fetchLog,
  });
  return { report, warnings };
}
