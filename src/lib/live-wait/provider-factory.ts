import { createQueueTimesAdapter } from "@/lib/live-wait/providers/queue-times-adapter";
import type { LiveWaitProviderAdapter } from "@/lib/live-wait/providers/types";

export function getLiveWaitProviderAdapter(): LiveWaitProviderAdapter {
  const p = (process.env.LIVE_WAIT_PROVIDER ?? "queue_times").trim();
  if (p === "queue_times") return createQueueTimesAdapter();
  throw new Error(`Unknown LIVE_WAIT_PROVIDER: ${p}`);
}
