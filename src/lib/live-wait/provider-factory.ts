import {
  asLiveWaitAdapter,
  createThemeParkProvider,
  readProviderPolicy,
} from "@/lib/park-data/registry";
import type { LiveWaitProviderAdapter } from "@/lib/live-wait/providers/types";

/**
 * Single-provider adapter. Ingestion itself runs through `runThemeParkIngest`,
 * which honours primary and fallback. This remains for callers that want one
 * adapter: `LIVE_WAIT_PROVIDER` when set, otherwise the primary provider.
 */
export function getLiveWaitProviderAdapter(): LiveWaitProviderAdapter {
  const policy = readProviderPolicy();
  const providerId = policy.legacySingleProvider ?? policy.primary;
  return asLiveWaitAdapter(createThemeParkProvider(providerId));
}
