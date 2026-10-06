/**
 * Queue-Times remains the fallback live-wait provider.
 * Its public API (checked via https://queue-times.com/en-US/pages/api and
 * parks.json on 2026-10-06) exposes park lists and queue times, not park
 * schedules. Schedule requests return no rows rather than a guessed window.
 */

import { createQueueTimesAdapter } from "@/lib/live-wait/providers/queue-times-adapter";
import {
  PROVIDER_QUEUE_TIMES,
  type AttractionLiveState,
  type ThemeParkDataProvider,
} from "@/lib/park-data/types";

export function createQueueTimesParkProvider(): ThemeParkDataProvider {
  const waits = createQueueTimesAdapter();
  return {
    providerId: PROVIDER_QUEUE_TIMES,
    supportsSchedule: false,
    supportsLiveWaits: true,

    async listParks(signal) {
      const parks = await waits.listParks(signal);
      return parks.map((park) => ({
        id: park.externalParkId,
        name: park.name,
        destinationName: null,
        timezone: null,
      }));
    },

    async fetchLiveAttractions(providerParkId, signal) {
      const rows = await waits.fetchWaitsForPark(providerParkId, signal);
      return rows.map(
        (row): AttractionLiveState => ({
          providerParkId: row.externalParkId,
          providerAttractionId: row.externalAttractionId,
          name: row.externalName,
          operatingStatus: row.operatingStatus,
          isOpen: row.isOpen,
          waitMinutes: row.waitMinutes,
          meta: {
            provider: PROVIDER_QUEUE_TIMES,
            sourceId: row.externalAttractionId,
            fetchedAt: new Date().toISOString(),
            observedAt: row.observedAt,
            staleAfter: null,
            confidence: null,
            provenanceKind: "LIVE_OBSERVATION",
          },
          rawPayload: row.rawPayload,
        }),
      );
    },

    async fetchSchedule() {
      return [];
    },
  };
}
