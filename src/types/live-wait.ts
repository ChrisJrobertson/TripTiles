/**
 * Live wait times subsystem (provider snapshots — not static catalogue).
 * DB columns mirror `supabase/migrations/20260513120000_live_wait_times_subsystem.sql`.
 */

export type LiveWaitOperatingStatus =
  | "open"
  | "closed"
  | "temporarily_closed"
  | "refurb"
  | "down"
  | "unknown";

/** Row in `live_wait_provider_mappings`. */
export interface LiveWaitProviderMapping {
  id: string;
  provider: string;
  external_park_id: string;
  external_attraction_id: string;
  park_id: string | null;
  attraction_id: string | null;
  external_name: string | null;
  mapping_confidence: number | null;
  created_at: string;
  updated_at: string;
}

/** Row in `live_wait_snapshots` (append-only history). */
export interface LiveWaitSnapshot {
  id: string;
  provider: string;
  park_id: string | null;
  attraction_id: string | null;
  external_park_id: string;
  external_attraction_id: string;
  external_name: string | null;
  wait_minutes: number | null;
  operating_status: LiveWaitOperatingStatus;
  is_open: boolean;
  observed_at: string;
  fetched_at: string;
  raw_payload: Record<string, unknown>;
}

/** Row in `live_wait_current` (latest per provider external key). */
export interface LiveWaitCurrent {
  id: string;
  provider: string;
  park_id: string | null;
  attraction_id: string | null;
  external_park_id: string;
  external_attraction_id: string;
  external_name: string | null;
  wait_minutes: number | null;
  operating_status: LiveWaitOperatingStatus;
  is_open: boolean;
  observed_at: string;
  fetched_at: string;
  stale_after: string;
  raw_payload: Record<string, unknown>;
}
