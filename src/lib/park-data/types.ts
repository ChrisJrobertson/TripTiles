/**
 * Normalised theme-park data contract.
 *
 * Planner, sequencer, and forecast code should depend on these types.
 * Provider field names stay inside provider adapters.
 *
 * Authority and provider preference are separate:
 * - Preference chooses which provider to ask first.
 * - Provenance says how much trust the evidence supports.
 * ThemeParks.wiki is a third-party provider, never a first-party park operator.
 */

import type { LiveWaitOperatingStatus } from "@/types/live-wait";

export const PROVIDER_THEMEPARKS_WIKI = "themeparks_wiki";
export const PROVIDER_QUEUE_TIMES = "queue_times";

/**
 * Planning-fact categories. Forecasts and LLM text are not fact sources.
 *
 * OFFICIAL_FACT — first-party park/operator statement.
 * PROVIDER_OBSERVATION — third-party operational provider (ThemeParks.wiki, Queue-Times).
 * LIVE_OBSERVATION / HISTORICAL_OBSERVATION — timed operational reads.
 * DERIVED_CALCULATION — deterministic TripTiles math.
 * TRIPTILES_RULE — curated catalogue / product rules.
 * USER_INPUT — explicit guest input.
 * FALLBACK_ASSUMPTION — labelled synthetic stand-in, never confirmed hours.
 */
export type ProvenanceKind =
  | "OFFICIAL_FACT"
  | "PROVIDER_OBSERVATION"
  | "LIVE_OBSERVATION"
  | "HISTORICAL_OBSERVATION"
  | "DERIVED_CALCULATION"
  | "TRIPTILES_RULE"
  | "USER_INPUT"
  | "FALLBACK_ASSUMPTION";

export type FreshnessState = "LIVE" | "RECENT" | "STALE" | "UNKNOWN";

/**
 * Mapping verification state.
 *
 * confirmed_exact / manually_approved — verified.
 * legacy_unverified — pre-existing operational mapping without a recorded human review.
 * candidate / ambiguous / missing / retired — not usable as facts.
 */
export type MatchStatus =
  | "confirmed_exact"
  | "manually_approved"
  | "legacy_unverified"
  | "candidate"
  | "missing"
  | "retired"
  | "ambiguous";

export type ScheduleKind =
  | "operating"
  | "early_entry"
  | "extra_hours"
  | "special"
  | "closed";

export type FactProvenance = {
  kind: ProvenanceKind;
  provider: string | null;
  sourceEntityId: string | null;
  observedAt: string | null;
  fetchedAt: string | null;
  staleAfter: string | null;
  verificationState: string | null;
  /** Null when the provider does not score confidence. Never invent a score. */
  confidence: number | null;
};

export type ProviderFetchMeta = {
  provider: string;
  sourceId: string | null;
  fetchedAt: string;
  observedAt: string | null;
  staleAfter: string | null;
  confidence: number | null;
  provenanceKind: ProvenanceKind;
};

export type ProviderParkRef = {
  id: string;
  name: string;
  destinationName: string | null;
  timezone: string | null;
};

export type ParkScheduleWindow = {
  operatingDate: string;
  opensAt: string | null;
  closesAt: string | null;
  scheduleKind: ScheduleKind;
  description: string | null;
  timezone: string | null;
  /** Stable key so two special events on one date can both be stored. */
  scheduleKey: string;
  meta: ProviderFetchMeta;
  rawPayload: Record<string, unknown>;
};

export type AttractionLiveState = {
  providerParkId: string;
  providerAttractionId: string;
  name: string;
  operatingStatus: LiveWaitOperatingStatus;
  isOpen: boolean;
  /** Null when the provider did not post a wait. Zero is a posted zero, not a missing wait. */
  waitMinutes: number | null;
  meta: ProviderFetchMeta;
  rawPayload: Record<string, unknown>;
};

export type ParkProviderErrorCode =
  | "timeout"
  | "http"
  | "invalid_json"
  | "invalid_payload"
  | "rate_limited";

export class ParkProviderError extends Error {
  readonly code: ParkProviderErrorCode;
  readonly status: number | null;

  constructor(code: ParkProviderErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "ParkProviderError";
    this.code = code;
    this.status = status;
  }
}

export interface ThemeParkDataProvider {
  readonly providerId: string;
  readonly supportsSchedule: boolean;
  readonly supportsLiveWaits: boolean;
  listParks(signal?: AbortSignal): Promise<ProviderParkRef[]>;
  fetchLiveAttractions(
    providerParkId: string,
    signal?: AbortSignal,
  ): Promise<AttractionLiveState[]>;
  fetchSchedule(
    providerParkId: string,
    signal?: AbortSignal,
  ): Promise<ParkScheduleWindow[]>;
}
