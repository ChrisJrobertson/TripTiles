/**
 * Queue-Times.com public JSON API (crowd-sourced wait times).
 *
 * Primary source: Queue Times “Theme Park Wait Times API” (Real Time API), including
 * `parks.json` and `parks/{id}/queue_times.json` — https://queue-times.com/en-US/pages/api
 *
 * Terms: free access requires prominent “Powered by Queue-Times.com” linking to
 * https://queue-times.com/en-US wherever waits are shown to end users (ingestion alone is fine).
 *
 * Endpoint shape (May 2026):
 * - Park index: `GET {base}/parks.json`
 * - Waits: `GET {base}/parks/{parkId}/queue_times.json`
 */

import { fetchJson } from "@/lib/live-wait/fetch-json";
import type {
  LiveWaitExternalPark,
  LiveWaitProviderAdapter,
  LiveWaitProviderRideRow,
} from "@/lib/live-wait/providers/types";
import type { LiveWaitOperatingStatus } from "@/types/live-wait";

function operatingStatusFromOpen(isOpen: boolean): LiveWaitOperatingStatus {
  return isOpen ? "open" : "closed";
}

type QueueTimesParksJson = {
  id: number;
  name: string;
  parks: { id: number; name: string }[];
}[];

type QueueTimesRide = {
  id: number;
  name: string;
  is_open: boolean;
  wait_time: number;
  last_updated: string;
};

type QueueTimesLand = {
  id: number;
  name: string;
  rides: QueueTimesRide[];
};

type QueueTimesParkJson = {
  lands: QueueTimesLand[];
  rides: QueueTimesRide[];
};

function baseUrl(): string {
  const raw =
    process.env.LIVE_WAIT_QUEUE_TIMES_BASE_URL?.trim() ||
    "https://queue-times.com/en-US";
  return raw.replace(/\/$/, "");
}

export function createQueueTimesAdapter(): LiveWaitProviderAdapter {
  const providerId = "queue_times";

  return {
    providerId,

    async listParks(signal) {
      const data = await fetchJson<QueueTimesParksJson>(
        `${baseUrl()}/parks.json`,
        { method: "GET" },
        { signal, retries: 2, timeoutMs: 25_000 },
      );
      const out: LiveWaitExternalPark[] = [];
      for (const group of data) {
        for (const p of group.parks ?? []) {
          out.push({
            externalParkId: String(p.id),
            name: p.name,
          });
        }
      }
      return out;
    },

    async fetchWaitsForPark(externalParkId, signal) {
      const data = await fetchJson<QueueTimesParkJson>(
        `${baseUrl()}/parks/${encodeURIComponent(externalParkId)}/queue_times.json`,
        { method: "GET" },
        { signal, retries: 2, timeoutMs: 25_000 },
      );

      const rows: LiveWaitProviderRideRow[] = [];

      const pushRide = (landName: string | null, ride: QueueTimesRide) => {
        const observed = new Date(ride.last_updated);
        const observedAt = Number.isNaN(observed.getTime())
          ? new Date().toISOString()
          : observed.toISOString();

        rows.push({
          externalParkId,
          externalAttractionId: String(ride.id),
          externalName: ride.name,
          waitMinutes:
            typeof ride.wait_time === "number" && ride.wait_time >= 0
              ? ride.wait_time
              : null,
          isOpen: Boolean(ride.is_open),
          operatingStatus: operatingStatusFromOpen(Boolean(ride.is_open)),
          observedAt,
          rawPayload: {
            land: landName,
            ride,
            external_park_id: externalParkId,
          },
        });
      };

      for (const land of data.lands ?? []) {
        const landName = typeof land.name === "string" ? land.name : null;
        for (const ride of land.rides ?? []) {
          pushRide(landName, ride);
        }
      }
      for (const ride of data.rides ?? []) {
        pushRide(null, ride);
      }

      return rows;
    },
  };
}
