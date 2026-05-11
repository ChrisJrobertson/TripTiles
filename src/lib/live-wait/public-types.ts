import type { LiveWaitOperatingStatus } from "@/types/live-wait";

/** Shape returned by `GET /api/live-wait/current` (subset of `live_wait_current`). */
export type LiveWaitPublicItem = {
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
};

export type LiveWaitCurrentApiResponse = {
  items: LiveWaitPublicItem[];
  /** True when any row uses Queue-Times — UI must show attribution. */
  showQueueTimesAttribution: boolean;
};
