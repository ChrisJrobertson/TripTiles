import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { LiveWaitProviderAdapter } from "@/lib/live-wait/providers/types";
import type { LiveWaitProviderMapping } from "@/types/live-wait";

export type LiveWaitIngestLog = {
  provider: string;
  dryRun: boolean;
  /** Set when `LIVE_WAIT_INGEST_DISABLED=1` — no provider fetch or DB writes. */
  skipped?: boolean;
  skipReason?: string | null;
  parksRequested: string[];
  parksFetchedOk: number;
  parksFailed: number;
  ridesFetched: number;
  rowsMapped: number;
  rowsUnmapped: number;
  snapshotsWritten: number;
  currentUpserted: number;
  parkErrors: { externalParkId: string; message: string }[];
  unmappedSamples: { externalParkId: string; externalAttractionId: string; name: string }[];
};

export type LiveWaitIngestOptions = {
  /** Required for writes; optional for dry-run unless mapping counts are needed. */
  supabaseUrl?: string;
  serviceRoleKey?: string;
  adapter: LiveWaitProviderAdapter;
  /** External park ids to ingest (provider-native). */
  externalParkIds: string[];
  staleAfterMinutes: number;
  dryRun: boolean;
  signal?: AbortSignal;
};

function mappingKey(
  provider: string,
  externalParkId: string,
  externalAttractionId: string,
) {
  return `${provider}\t${externalParkId}\t${externalAttractionId}`;
}

function addStaleAfter(isoObserved: string, minutes: number): string {
  const d = new Date(isoObserved);
  const t = d.getTime();
  const base = Number.isNaN(t) ? Date.now() : t;
  return new Date(base + minutes * 60_000).toISOString();
}

export async function runLiveWaitIngest(
  options: LiveWaitIngestOptions,
): Promise<LiveWaitIngestLog> {
  if (process.env.LIVE_WAIT_INGEST_DISABLED?.trim() === "1") {
    return {
      provider: options.adapter.providerId,
      dryRun: options.dryRun,
      skipped: true,
      skipReason: "LIVE_WAIT_INGEST_DISABLED=1",
      parksRequested: [...options.externalParkIds],
      parksFetchedOk: 0,
      parksFailed: 0,
      ridesFetched: 0,
      rowsMapped: 0,
      rowsUnmapped: 0,
      snapshotsWritten: 0,
      currentUpserted: 0,
      parkErrors: [],
      unmappedSamples: [],
    };
  }

  const log: LiveWaitIngestLog = {
    provider: options.adapter.providerId,
    dryRun: options.dryRun,
    parksRequested: [...options.externalParkIds],
    parksFetchedOk: 0,
    parksFailed: 0,
    ridesFetched: 0,
    rowsMapped: 0,
    rowsUnmapped: 0,
    snapshotsWritten: 0,
    currentUpserted: 0,
    parkErrors: [],
    unmappedSamples: [],
  };

  const provider = options.adapter.providerId;
  const staleMinutes = options.staleAfterMinutes;

  const url = options.supabaseUrl?.trim();
  const key = options.serviceRoleKey?.trim();
  const supabase: SupabaseClient | null =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  if (!options.dryRun && !supabase) {
    throw new Error(
      "Supabase URL and service role key are required for live wait ingest writes.",
    );
  }

  let mappingRows: LiveWaitProviderMapping[] = [];
  if (supabase) {
    const { data, error } = await supabase
      .from("live_wait_provider_mappings")
      .select(
        "id, provider, external_park_id, external_attraction_id, park_id, attraction_id, external_name, mapping_confidence, created_at, updated_at",
      )
      .eq("provider", provider);

    if (error) {
      throw new Error(`live_wait_provider_mappings: ${error.message}`);
    }
    mappingRows = (data ?? []) as LiveWaitProviderMapping[];
  }

  const mapByKey = new Map<string, LiveWaitProviderMapping>();
  for (const m of mappingRows) {
    mapByKey.set(
      mappingKey(
        m.provider,
        String(m.external_park_id ?? ""),
        String(m.external_attraction_id ?? ""),
      ),
      m,
    );
  }

  const fetchedAt = new Date().toISOString();
  const snapshotBatch: Record<string, unknown>[] = [];
  const currentBatch: Record<string, unknown>[] = [];

  const recordUnmappedSample = (row: {
    externalParkId: string;
    externalAttractionId: string;
    externalName: string;
  }) => {
    if (log.unmappedSamples.length >= 25) return;
    log.unmappedSamples.push({
      externalParkId: row.externalParkId,
      externalAttractionId: row.externalAttractionId,
      name: row.externalName,
    });
  };

  for (const externalParkId of options.externalParkIds) {
    try {
      const rides = await options.adapter.fetchWaitsForPark(
        externalParkId,
        options.signal,
      );
      log.parksFetchedOk += 1;
      log.ridesFetched += rides.length;

      for (const r of rides) {
        const mk = mappingKey(provider, r.externalParkId, r.externalAttractionId);
        const mapped = mapByKey.get(mk);
        const parkId =
          mapped && typeof mapped.park_id === "string"
            ? mapped.park_id
            : null;
        const attractionId =
          mapped && typeof mapped.attraction_id === "string"
            ? mapped.attraction_id
            : null;

        if (attractionId) log.rowsMapped += 1;
        else {
          log.rowsUnmapped += 1;
          recordUnmappedSample(r);
        }

        const staleAfter = addStaleAfter(r.observedAt, staleMinutes);

        const snapshotRow = {
          provider,
          park_id: parkId,
          attraction_id: attractionId,
          external_park_id: r.externalParkId,
          external_attraction_id: r.externalAttractionId,
          external_name: r.externalName,
          wait_minutes: r.waitMinutes,
          operating_status: r.operatingStatus,
          is_open: r.isOpen,
          observed_at: r.observedAt,
          fetched_at: fetchedAt,
          raw_payload: r.rawPayload,
        };

        const currentRow = {
          provider,
          park_id: parkId,
          attraction_id: attractionId,
          external_park_id: r.externalParkId,
          external_attraction_id: r.externalAttractionId,
          external_name: r.externalName,
          wait_minutes: r.waitMinutes,
          operating_status: r.operatingStatus,
          is_open: r.isOpen,
          observed_at: r.observedAt,
          fetched_at: fetchedAt,
          stale_after: staleAfter,
          raw_payload: r.rawPayload,
        };

        snapshotBatch.push(snapshotRow);
        currentBatch.push(currentRow);
      }
    } catch (err) {
      log.parksFailed += 1;
      const message = err instanceof Error ? err.message : String(err);
      log.parkErrors.push({ externalParkId, message });
    }
  }

  if (options.dryRun) {
    return log;
  }

  if (!supabase) {
    throw new Error("Supabase client missing after dry-run guard.");
  }

  const db = supabase;

  const flushSnapshots = async (rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const chunk = 400;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const { error } = await db.from("live_wait_snapshots").insert(slice);
      if (error) throw new Error(`live_wait_snapshots insert: ${error.message}`);
      log.snapshotsWritten += slice.length;
    }
  };

  const flushCurrent = async (rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const chunk = 200;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const { error } = await db.from("live_wait_current").upsert(slice, {
        onConflict: "provider,external_park_id,external_attraction_id",
      });
      if (error) throw new Error(`live_wait_current upsert: ${error.message}`);
      log.currentUpserted += slice.length;
    }
  };

  await flushSnapshots(snapshotBatch);
  await flushCurrent(currentBatch);

  return log;
}
