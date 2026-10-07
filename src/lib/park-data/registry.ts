import { liveWaitExternalParkIdsFromEnv } from "@/lib/live-wait/ingest-env";
import type { LiveWaitProviderAdapter, LiveWaitProviderRideRow } from "@/lib/live-wait/providers/types";
import { orlandoExternalParkIds } from "@/lib/park-data/orlando-parks";
import { createQueueTimesParkProvider } from "@/lib/park-data/providers/queue-times";
import { createThemeParksWikiProvider } from "@/lib/park-data/providers/themeparks-wiki";
import {
  PROVIDER_QUEUE_TIMES,
  PROVIDER_THEMEPARKS_WIKI,
  type AttractionLiveState,
  type ThemeParkDataProvider,
} from "@/lib/park-data/types";

export type ProviderPolicy = {
  /** When set, ingest that provider only. Keeps an existing LIVE_WAIT_PROVIDER deployment stable. */
  legacySingleProvider: string | null;
  primary: string;
  fallback: string | null;
};

export function readProviderPolicy(
  env: Record<string, string | undefined> = process.env,
): ProviderPolicy {
  const legacy = env.LIVE_WAIT_PROVIDER?.trim() || null;
  const primary = env.THEME_PARK_PRIMARY_PROVIDER?.trim() || PROVIDER_THEMEPARKS_WIKI;
  const fallbackRaw = env.THEME_PARK_FALLBACK_PROVIDER?.trim();
  const fallback =
    fallbackRaw == null || fallbackRaw === ""
      ? PROVIDER_QUEUE_TIMES
      : fallbackRaw === "none"
        ? null
        : fallbackRaw;
  return {
    legacySingleProvider: legacy,
    primary,
    fallback: legacy ? null : fallback === primary ? null : fallback,
  };
}

export function providerIdsForIngest(policy: ProviderPolicy = readProviderPolicy()): string[] {
  if (policy.legacySingleProvider) return [policy.legacySingleProvider];
  return [policy.primary, policy.fallback].filter((id): id is string => Boolean(id));
}

export function createThemeParkProvider(providerId: string): ThemeParkDataProvider {
  if (providerId === PROVIDER_QUEUE_TIMES) return createQueueTimesParkProvider();
  if (providerId === PROVIDER_THEMEPARKS_WIKI) return createThemeParksWikiProvider();
  throw new Error(`Unknown theme park provider: ${providerId}`);
}

export function externalParkIdsForProvider(providerId: string): string[] {
  if (providerId === PROVIDER_THEMEPARKS_WIKI) {
    const raw = process.env.THEMEPARKS_WIKI_PARK_IDS?.trim();
    if (raw) return splitIds(raw);
    return orlandoExternalParkIds(PROVIDER_THEMEPARKS_WIKI);
  }
  if (providerId === PROVIDER_QUEUE_TIMES) {
    return liveWaitExternalParkIdsFromEnv();
  }
  return [];
}

function splitIds(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function toLiveWaitRideRow(state: AttractionLiveState): LiveWaitProviderRideRow {
  return {
    externalParkId: state.providerParkId,
    externalAttractionId: state.providerAttractionId,
    externalName: state.name,
    waitMinutes: state.waitMinutes,
    isOpen: state.isOpen,
    operatingStatus: state.operatingStatus,
    observedAt: state.meta.observedAt ?? state.meta.fetchedAt,
    rawPayload: state.rawPayload,
  };
}

export function asLiveWaitAdapter(provider: ThemeParkDataProvider): LiveWaitProviderAdapter {
  return {
    providerId: provider.providerId,
    async listParks(signal) {
      const parks = await provider.listParks(signal);
      return parks.map((park) => ({ externalParkId: park.id, name: park.name }));
    },
    async fetchWaitsForPark(externalParkId, signal) {
      const rows = await provider.fetchLiveAttractions(externalParkId, signal);
      return rows.map(toLiveWaitRideRow);
    },
  };
}
