/**
 * Provider adapter contract for live wait ingestion (multiple sources later).
 */

import type { LiveWaitOperatingStatus } from "@/types/live-wait";

export type LiveWaitExternalPark = {
  externalParkId: string;
  name: string;
};

/** One ride/attraction line normalised from a provider (pre-mapping to TripTiles ids). */
export type LiveWaitProviderRideRow = {
  externalParkId: string;
  externalAttractionId: string;
  externalName: string;
  waitMinutes: number | null;
  isOpen: boolean;
  operatingStatus: LiveWaitOperatingStatus;
  /** Provider-reported observation instant (UTC ISO). */
  observedAt: string;
  /** Original provider document for `raw_payload` (must be JSON-serialisable). */
  rawPayload: Record<string, unknown>;
};

export interface LiveWaitProviderAdapter {
  /** Stable id matching `live_wait_*` rows and `live_wait_provider_mappings.provider`. */
  readonly providerId: string;
  listParks(signal?: AbortSignal): Promise<LiveWaitExternalPark[]>;
  /** Fetch all rides with waits for a single external park. */
  fetchWaitsForPark(
    externalParkId: string,
    signal?: AbortSignal,
  ): Promise<LiveWaitProviderRideRow[]>;
}
