/**
 * ThemeParks.wiki v1 adapter.
 *
 * Verified 2026-10-06 against:
 * - https://www.themeparks.wiki/api
 * - https://www.themeparks.wiki/api/http
 * - GET https://api.themeparks.wiki/v1/destinations
 * - GET https://api.themeparks.wiki/v1/entity/{id}
 * - GET https://api.themeparks.wiki/v1/entity/{id}/live
 * - GET https://api.themeparks.wiki/v1/entity/{id}/schedule
 *
 * Terms observed that day: live data, schedules, and the entity tree need no
 * API key. Commercial use is allowed. Products that show the data must display
 * “Powered by ThemeParks.wiki” unless a paid plan removes that requirement.
 * Do not republish the feed as a data API for other software.
 *
 * Rate limits are per key, or per IP when no key is sent. Design for HTTP 429
 * and Retry-After. Live responses are cached by the provider for about 60
 * seconds; TripTiles cron stays at 5 minutes.
 *
 * Assumptions:
 * - Base path is /v1. Month schedules, when used later, need a two-digit month.
 * - Calendar dates and the offset inside openingTime/closingTime are park-local.
 * - Absent STANDBY.waitTime means no posted wait, not zero.
 * - An entity missing from liveData is no data, not a closed ride. This adapter
 *   only emits entityType ATTRACTION so shows and restaurants are not stored
 *   as ride waits.
 * - Schedule `purchases` (ticket prices) are dropped and are not planning facts.
 */

import type { LiveWaitOperatingStatus } from "@/types/live-wait";
import { safeErrorMessage } from "@/lib/park-data/safe-log";
import { parkLocalHHmm } from "@/lib/park-data/schedule";
import {
  ParkProviderError,
  PROVIDER_THEMEPARKS_WIKI,
  type AttractionLiveState,
  type ParkScheduleWindow,
  type ProviderParkRef,
  type ScheduleKind,
  type ThemeParkDataProvider,
} from "@/lib/park-data/types";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type ThemeParksWikiOptions = {
  fetchImpl?: FetchLike;
  baseUrl?: string;
  apiKey?: string | null;
  now?: () => Date;
  timeoutMs?: number;
  staleAfterMinutes?: number;
  scheduleStaleAfterHours?: number;
};

const USER_AGENT = "TripTilesParkData/1.0 (+https://triptiles.app)";

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === "AbortError") ||
    (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError")
  );
}

function baseUrlFromEnv(override?: string): string {
  const raw = override?.trim() || process.env.THEMEPARKS_WIKI_BASE_URL?.trim() || "https://api.themeparks.wiki/v1";
  return raw.replace(/\/$/, "");
}

function apiKeyFromEnv(override?: string | null): string | null {
  if (override !== undefined) return override?.trim() || null;
  return process.env.THEMEPARKS_WIKI_API_KEY?.trim() || null;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ParkProviderError("invalid_json", "ThemeParks.wiki returned invalid JSON");
  }
}

async function fetchDocument(
  url: string,
  fetchImpl: FetchLike,
  signal: AbortSignal | undefined,
  apiKey: string | null,
  timeoutMs: number,
): Promise<unknown> {
  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      };
      if (apiKey) headers["x-api-key"] = apiKey;
      return await fetchImpl(url, { method: "GET", headers, signal: controller.signal });
    } catch (err) {
      if (isAbortError(err) || (err instanceof Error && err.name === "AbortError")) {
        throw new ParkProviderError("timeout", "ThemeParks.wiki request timed out");
      }
      throw new ParkProviderError("http", safeErrorMessage(err));
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  };

  let res = await attempt();
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") ?? "2");
    const waitMs = Math.min(15_000, Math.max(0, (Number.isFinite(retryAfter) ? retryAfter : 2) * 1000));
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    res = await attempt();
    if (res.status === 429) {
      throw new ParkProviderError("rate_limited", "ThemeParks.wiki rate limited the request", 429);
    }
  }
  if (!res.ok) {
    throw new ParkProviderError("http", `ThemeParks.wiki HTTP ${res.status}`, res.status);
  }
  return readJson(res);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function operatingStatus(status: unknown): { operatingStatus: LiveWaitOperatingStatus; isOpen: boolean } {
  if (status === "OPERATING") return { operatingStatus: "open", isOpen: true };
  if (status === "DOWN") return { operatingStatus: "down", isOpen: false };
  if (status === "CLOSED") return { operatingStatus: "closed", isOpen: false };
  if (status === "REFURBISHMENT") return { operatingStatus: "refurb", isOpen: false };
  return { operatingStatus: "unknown", isOpen: false };
}

function standbyWait(queue: unknown): number | null {
  const record = asRecord(queue);
  const standby = asRecord(record?.STANDBY);
  const wait = standby?.waitTime;
  if (typeof wait === "number" && Number.isFinite(wait) && wait >= 0) return wait;
  return null;
}

function scheduleKind(type: unknown, description: unknown): ScheduleKind | null {
  const text = typeof type === "string" ? type.trim().toUpperCase() : "";
  const desc = typeof description === "string" ? description : "";
  if (text === "OPERATING") return "operating";
  if (text === "EXTRA_HOURS" || text === "EXTENDED_HOURS" || text.includes("EXTRA")) {
    return "extra_hours";
  }
  if (text.includes("CLOSED")) return "closed";
  if (/early entry/i.test(desc) || text === "EARLY_ENTRY") return "early_entry";
  if (text === "TICKETED_EVENT" || text.length > 0) return "special";
  return null;
}

export function normaliseThemeParksLive(args: {
  providerParkId: string;
  payload: unknown;
  fetchedAt: string;
  staleAfter: string;
}): AttractionLiveState[] {
  const root = asRecord(args.payload);
  if (!root || !Array.isArray(root.liveData)) {
    throw new ParkProviderError("invalid_payload", "ThemeParks.wiki live payload has no liveData array");
  }
  const rows: AttractionLiveState[] = [];
  for (const item of root.liveData) {
    const row = asRecord(item);
    if (!row) continue;
    if (row.entityType !== "ATTRACTION") continue;
    if (typeof row.id !== "string" || !row.id.trim()) continue;
    if (typeof row.name !== "string" || !row.name.trim()) continue;
    const status = operatingStatus(row.status);
    const observedAt = typeof row.lastUpdated === "string" ? row.lastUpdated : args.fetchedAt;
    rows.push({
      providerParkId: args.providerParkId,
      providerAttractionId: row.id,
      name: row.name,
      operatingStatus: status.operatingStatus,
      isOpen: status.isOpen,
      waitMinutes: standbyWait(row.queue),
      meta: {
        provider: PROVIDER_THEMEPARKS_WIKI,
        sourceId: row.id,
        fetchedAt: args.fetchedAt,
        observedAt,
        staleAfter: args.staleAfter,
        confidence: null,
        provenanceKind: "LIVE_OBSERVATION",
      },
      rawPayload: {
        id: row.id,
        name: row.name,
        entityType: row.entityType,
        status: row.status ?? null,
        lastUpdated: row.lastUpdated ?? null,
        queue: row.queue ?? null,
      },
    });
  }
  return rows;
}

export function normaliseThemeParksSchedule(args: {
  payload: unknown;
  fetchedAt: string;
  staleAfter: string;
}): ParkScheduleWindow[] {
  const root = asRecord(args.payload);
  if (!root || !Array.isArray(root.schedule)) {
    throw new ParkProviderError("invalid_payload", "ThemeParks.wiki schedule payload has no schedule array");
  }
  const timezone = typeof root.timezone === "string" ? root.timezone : null;
  const windows: ParkScheduleWindow[] = [];
  for (const item of root.schedule) {
    const row = asRecord(item);
    if (!row) continue;
    if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    const kind = scheduleKind(row.type, row.description);
    if (!kind) continue;
    const opening = typeof row.openingTime === "string" ? row.openingTime : null;
    const closing = typeof row.closingTime === "string" ? row.closingTime : null;
    const opensAt = opening ? parkLocalHHmm(opening, row.date) : null;
    const closesAt = closing ? parkLocalHHmm(closing, row.date) : null;
    if (!opensAt || !closesAt) continue;
    const description = typeof row.description === "string" ? row.description : null;
    const scheduleKey = `${kind}:${opening}:${closing}`;
    windows.push({
      operatingDate: row.date,
      opensAt,
      closesAt,
      scheduleKind: kind,
      description,
      timezone,
      scheduleKey,
      meta: {
        provider: PROVIDER_THEMEPARKS_WIKI,
        sourceId: typeof root.id === "string" ? root.id : null,
        fetchedAt: args.fetchedAt,
        observedAt: args.fetchedAt,
        staleAfter: args.staleAfter,
        confidence: null,
        provenanceKind: "AUTHORITATIVE_FACT",
      },
      rawPayload: {
        date: row.date,
        type: row.type ?? null,
        description,
        openingTime: opening,
        closingTime: closing,
      },
    });
  }
  return windows;
}

export function createThemeParksWikiProvider(
  options: ThemeParksWikiOptions = {},
): ThemeParkDataProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const root = baseUrlFromEnv(options.baseUrl);
  const apiKey = apiKeyFromEnv(options.apiKey);
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? 25_000;
  const staleMinutes = options.staleAfterMinutes ?? positiveMinutes(process.env.LIVE_WAIT_STALE_AFTER_MINUTES, 15);
  const scheduleHours = options.scheduleStaleAfterHours ?? positiveMinutes(process.env.THEME_PARK_SCHEDULE_STALE_AFTER_HOURS, 12);

  const addMinutes = (iso: string, minutes: number) =>
    new Date(Date.parse(iso) + minutes * 60_000).toISOString();

  return {
    providerId: PROVIDER_THEMEPARKS_WIKI,
    supportsSchedule: true,
    supportsLiveWaits: true,

    async listParks(signal) {
      const payload = await fetchDocument(`${root}/destinations`, fetchImpl, signal, apiKey, timeoutMs);
      const body = asRecord(payload);
      if (!body || !Array.isArray(body.destinations)) {
        throw new ParkProviderError("invalid_payload", "ThemeParks.wiki destinations payload was invalid");
      }
      const parks: ProviderParkRef[] = [];
      for (const destination of body.destinations) {
        const dest = asRecord(destination);
        if (!dest || !Array.isArray(dest.parks)) continue;
        const destinationName = typeof dest.name === "string" ? dest.name : null;
        for (const park of dest.parks) {
          const row = asRecord(park);
          if (!row || typeof row.id !== "string" || typeof row.name !== "string") continue;
          parks.push({
            id: row.id,
            name: row.name,
            destinationName,
            timezone: typeof row.timezone === "string" ? row.timezone : null,
          });
        }
      }
      return parks;
    },

    async fetchLiveAttractions(providerParkId, signal) {
      const fetchedAt = now().toISOString();
      const payload = await fetchDocument(
        `${root}/entity/${encodeURIComponent(providerParkId)}/live`,
        fetchImpl,
        signal,
        apiKey,
        timeoutMs,
      );
      return normaliseThemeParksLive({
        providerParkId,
        payload,
        fetchedAt,
        staleAfter: addMinutes(fetchedAt, staleMinutes),
      });
    },

    async fetchSchedule(providerParkId, signal) {
      const fetchedAt = now().toISOString();
      const payload = await fetchDocument(
        `${root}/entity/${encodeURIComponent(providerParkId)}/schedule`,
        fetchImpl,
        signal,
        apiKey,
        timeoutMs,
      );
      return normaliseThemeParksSchedule({
        payload,
        fetchedAt,
        staleAfter: addMinutes(fetchedAt, scheduleHours * 60),
      });
    },
  };
}

function positiveMinutes(raw: string | undefined, fallback: number): number {
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
