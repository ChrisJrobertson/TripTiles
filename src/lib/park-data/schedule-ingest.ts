import type { SupabaseClient } from "@supabase/supabase-js";

import { mappingAllowsOperationalUse } from "@/lib/park-data/mapping";
import { safeErrorMessage } from "@/lib/park-data/safe-log";
import type { ParkScheduleWindow, ThemeParkDataProvider } from "@/lib/park-data/types";

export type ScheduleIngestLog = {
  provider: string;
  dryRun: boolean;
  parksRequested: string[];
  parksFetchedOk: number;
  parksFailed: number;
  windowsFetched: number;
  windowsWritten: number;
  parkErrors: { externalParkId: string; message: string }[];
};

export async function runScheduleIngest(options: {
  supabase: SupabaseClient | null;
  provider: ThemeParkDataProvider;
  externalParkIds: string[];
  dryRun: boolean;
  signal?: AbortSignal;
}): Promise<ScheduleIngestLog> {
  const log: ScheduleIngestLog = {
    provider: options.provider.providerId,
    dryRun: options.dryRun,
    parksRequested: [...options.externalParkIds],
    parksFetchedOk: 0,
    parksFailed: 0,
    windowsFetched: 0,
    windowsWritten: 0,
    parkErrors: [],
  };
  if (!options.provider.supportsSchedule) return log;

  const parkIdByExternal = new Map<string, string | null>();
  if (options.supabase) {
    const { data, error } = await options.supabase
      .from("live_wait_park_mappings")
      .select("external_park_id, park_id, match_status")
      .eq("provider", options.provider.providerId);
    if (!error) {
      for (const row of data ?? []) {
        const status = (row as { match_status?: string | null }).match_status;
        if (!mappingAllowsOperationalUse(status)) continue;
        const external = String((row as { external_park_id?: string }).external_park_id ?? "");
        const parkId = (row as { park_id?: string | null }).park_id ?? null;
        if (external) parkIdByExternal.set(external, parkId);
      }
    }
  }

  const rows: Record<string, unknown>[] = [];
  for (const externalParkId of options.externalParkIds) {
    try {
      const windows = await options.provider.fetchSchedule(externalParkId, options.signal);
      log.parksFetchedOk += 1;
      log.windowsFetched += windows.length;
      for (const window of windows) {
        rows.push(scheduleRow(options.provider.providerId, externalParkId, parkIdByExternal.get(externalParkId) ?? null, window));
      }
    } catch (err) {
      log.parksFailed += 1;
      log.parkErrors.push({ externalParkId, message: safeErrorMessage(err) });
    }
  }

  if (options.dryRun || !options.supabase || rows.length === 0) return log;

  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await options.supabase.from("park_operating_schedules").upsert(slice, {
      onConflict: "provider,external_park_id,operating_date,schedule_key",
    });
    if (error) {
      log.parkErrors.push({ externalParkId: "*", message: safeErrorMessage(error.message) });
      break;
    }
    log.windowsWritten += slice.length;
  }
  return log;
}

function scheduleRow(
  provider: string,
  externalParkId: string,
  parkId: string | null,
  window: ParkScheduleWindow,
): Record<string, unknown> {
  return {
    park_id: parkId,
    provider,
    external_park_id: externalParkId,
    operating_date: window.operatingDate,
    opens_at: window.opensAt,
    closes_at: window.closesAt,
    schedule_kind: window.scheduleKind,
    schedule_key: window.scheduleKey,
    timezone: window.timezone,
    provenance_kind: window.meta.provenanceKind,
    observed_at: window.meta.observedAt,
    fetched_at: window.meta.fetchedAt,
    stale_after: window.meta.staleAfter,
    confidence: window.meta.confidence,
    description: window.description,
    raw_payload: window.rawPayload,
  };
}
