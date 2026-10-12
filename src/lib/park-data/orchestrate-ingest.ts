import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { runLiveWaitIngest, type LiveWaitIngestLog } from "@/lib/live-wait/ingest-run";
import { liveWaitStaleAfterMinutesFromEnv } from "@/lib/live-wait/ingest-env";
import { dedupeLiveStates } from "@/lib/park-data/dedupe-live";
import {
  asLiveWaitAdapter,
  createThemeParkProvider,
  externalParkIdsForProvider,
  providerIdsForIngest,
  readProviderPolicy,
  toLiveWaitRideRow,
} from "@/lib/park-data/registry";
import { safeErrorMessage, logParkDataEvent } from "@/lib/park-data/safe-log";
import { runScheduleIngest, type ScheduleIngestLog } from "@/lib/park-data/schedule-ingest";
import type { ThemeParkDataProvider } from "@/lib/park-data/types";
import type { LiveWaitProviderAdapter } from "@/lib/live-wait/providers/types";

export type ProviderIngestReport = {
  provider: string;
  durationMs: number;
  live: LiveWaitIngestLog;
  schedule: ScheduleIngestLog | null;
};

export type ThemeParkIngestReport = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  providers: ProviderIngestReport[];
};

function dedupeAdapter(provider: ThemeParkDataProvider): LiveWaitProviderAdapter {
  return {
    providerId: provider.providerId,
    listParks(signal) {
      return asLiveWaitAdapter(provider).listParks(signal);
    },
    async fetchWaitsForPark(externalParkId, signal) {
      const states = await provider.fetchLiveAttractions(externalParkId, signal);
      const { rows } = dedupeLiveStates(states);
      return rows.map(toLiveWaitRideRow);
    },
  };
}

export async function runThemeParkIngest(options: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  dryRun: boolean;
  signal?: AbortSignal;
  supabase?: SupabaseClient | null;
}): Promise<ThemeParkIngestReport> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const supabase =
    options.supabase ??
    (options.supabaseUrl?.trim() && options.serviceRoleKey?.trim()
      ? createClient(options.supabaseUrl.trim(), options.serviceRoleKey.trim(), {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null);
  const policy = readProviderPolicy();
  const providers = providerIdsForIngest(policy);
  const reports: ProviderIngestReport[] = [];

  for (const providerId of providers) {
    const providerStarted = Date.now();
    let provider: ThemeParkDataProvider;
    try {
      provider = createThemeParkProvider(providerId);
    } catch (err) {
      const message = safeErrorMessage(err);
      logParkDataEvent("provider_unavailable", { provider: providerId, message });
      continue;
    }
    const externalParkIds = externalParkIdsForProvider(providerId);
    const adapter = dedupeAdapter(provider);
    let live: LiveWaitIngestLog;
    try {
      live = await runLiveWaitIngest({
        adapter,
        supabaseUrl: options.supabaseUrl,
        serviceRoleKey: options.serviceRoleKey,
        externalParkIds,
        staleAfterMinutes: liveWaitStaleAfterMinutesFromEnv(),
        dryRun: options.dryRun,
        signal: options.signal,
      });
    } catch (err) {
      live = {
        provider: providerId,
        dryRun: options.dryRun,
        parksRequested: externalParkIds,
        parksFetchedOk: 0,
        parksFailed: externalParkIds.length,
        ridesFetched: 0,
        rowsMapped: 0,
        rowsUnmapped: 0,
        snapshotsWritten: 0,
        currentUpserted: 0,
        staleRecords: 0,
        duplicatesSkipped: 0,
        parkErrors: [{ externalParkId: "*", message: safeErrorMessage(err) }],
        unmappedSamples: [],
      };
    }

    let schedule: ScheduleIngestLog | null = null;
    if (provider.supportsSchedule) {
      try {
        schedule = await runScheduleIngest({
          supabase,
          provider,
          externalParkIds,
          dryRun: options.dryRun,
          signal: options.signal,
        });
      } catch (err) {
        schedule = {
          provider: providerId,
          dryRun: options.dryRun,
          parksRequested: externalParkIds,
          parksFetchedOk: 0,
          parksFailed: 1,
          windowsFetched: 0,
          windowsWritten: 0,
          parkErrors: [{ externalParkId: "*", message: safeErrorMessage(err) }],
        };
      }
    }

    const durationMs = Date.now() - providerStarted;
    const report = { provider: providerId, durationMs, live, schedule };
    reports.push(report);
    logParkDataEvent("ingest_provider", {
      provider: providerId,
      durationMs,
      parksFetchedOk: live.parksFetchedOk,
      parksFailed: live.parksFailed,
      ridesFetched: live.ridesFetched,
      rowsMapped: live.rowsMapped,
      rowsUnmapped: live.rowsUnmapped,
      observationsWritten: live.currentUpserted,
      staleRecords: live.staleRecords,
      duplicatesSkipped: live.duplicatesSkipped,
      scheduleWindows: schedule?.windowsFetched ?? 0,
      scheduleFailures: schedule?.parksFailed ?? 0,
      failures: live.parkErrors.length + (schedule?.parkErrors.length ?? 0),
    });
    await writeFetchLog(supabase, report);
  }

  const finishedAt = new Date().toISOString();
  return {
    startedAt,
    finishedAt,
    durationMs: Date.now() - started,
    providers: reports,
  };
}

async function writeFetchLog(
  supabase: SupabaseClient | null,
  report: ProviderIngestReport,
): Promise<void> {
  if (!supabase) return;
  const rows = [
    {
      provider: report.provider,
      operation: "live",
      ok: report.live.parksFailed === 0 && report.live.parkErrors.length === 0,
      fetched_count: report.live.ridesFetched,
      mapped_count: report.live.rowsMapped,
      unmapped_count: report.live.rowsUnmapped,
      observations_written: report.live.currentUpserted,
      stale_count: report.live.staleRecords,
      error_message: report.live.parkErrors[0]?.message ?? null,
      duration_ms: report.durationMs,
    },
  ];
  if (report.schedule) {
    rows.push({
      provider: report.provider,
      operation: "schedule",
      ok: report.schedule.parksFailed === 0,
      fetched_count: report.schedule.windowsFetched,
      mapped_count: report.schedule.windowsWritten,
      unmapped_count: 0,
      observations_written: report.schedule.windowsWritten,
      stale_count: 0,
      error_message: report.schedule.parkErrors[0]?.message ?? null,
      duration_ms: report.durationMs,
    });
  }
  const { error } = await supabase.from("provider_fetch_log").insert(rows);
  if (error) {
    logParkDataEvent("fetch_log_write_failed", {
      provider: report.provider,
      message: safeErrorMessage(error.message),
    });
  }
}
