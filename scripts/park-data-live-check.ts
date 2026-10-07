/**
 * Live provider checks. Does not write to the database.
 *
 *   npx tsx scripts/park-data-live-check.ts
 *   npx tsx scripts/park-data-live-check.ts --provider=themeparks_wiki
 *   npx tsx scripts/park-data-live-check.ts --provider=queue_times
 */

import { classifyFreshness } from "@/lib/park-data/freshness";
import { orlandoIdentityByParkId } from "@/lib/park-data/orlando-parks";
import { createQueueTimesParkProvider } from "@/lib/park-data/providers/queue-times";
import { createThemeParksWikiProvider } from "@/lib/park-data/providers/themeparks-wiki";
import {
  PROVIDER_QUEUE_TIMES,
  PROVIDER_THEMEPARKS_WIKI,
} from "@/lib/park-data/types";

const THEMEPARKS_TARGETS = [
  "mk",
  "ep",
  "hs",
  "ak",
  "us",
  "ioa",
  "eu",
  "sw",
  "aq",
] as const;

const QUEUE_TIMES_TARGETS = ["mk", "us"] as const;

function argProvider(): string {
  const flag = process.argv.find((arg) => arg.startsWith("--provider="));
  if (!flag) return PROVIDER_THEMEPARKS_WIKI;
  return flag.slice("--provider=".length).trim() || PROVIDER_THEMEPARKS_WIKI;
}

async function checkThemeParksWiki() {
  const provider = createThemeParksWikiProvider({ apiKey: null });
  const now = new Date();
  const rows = [];
  for (const parkId of THEMEPARKS_TARGETS) {
    const identity = orlandoIdentityByParkId(parkId);
    const externalId = identity?.themeParksWikiId;
    if (!externalId) {
      rows.push({ parkId, error: "missing_themeparks_wiki_id" });
      continue;
    }
    const started = Date.now();
    try {
      const [schedule, live] = await Promise.all([
        provider.fetchSchedule(externalId),
        provider.fetchLiveAttractions(externalId),
      ]);
      const operating = schedule.filter((row) => row.scheduleKind === "operating");
      const first = operating[0] ?? null;
      const sample = live[0] ?? null;
      rows.push({
        provider: provider.providerId,
        parkId,
        providerParkId: externalId,
        scheduleWindows: schedule.length,
        operatingWindows: operating.length,
        firstOperating: first
          ? { date: first.operatingDate, open: first.opensAt, close: first.closesAt }
          : null,
        attractions: live.length,
        withPostedWait: live.filter((row) => row.waitMinutes != null).length,
        statuses: [...new Set(live.map((row) => row.operatingStatus))],
        sampleObservedAt: sample?.meta.observedAt ?? null,
        sampleFreshness: sample
          ? classifyFreshness({
              observedAt: sample.meta.observedAt,
              fetchedAt: sample.meta.fetchedAt,
              staleAfter: sample.meta.staleAfter,
              now,
            })
          : "UNKNOWN",
        scheduleProvenance: first?.meta.provenanceKind ?? null,
        durationMs: Date.now() - started,
      });
    } catch (err) {
      rows.push({
        provider: provider.providerId,
        parkId,
        providerParkId: externalId,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - started,
      });
    }
  }
  return rows;
}

async function checkQueueTimes() {
  const provider = createQueueTimesParkProvider();
  const now = new Date();
  const rows = [];
  for (const parkId of QUEUE_TIMES_TARGETS) {
    const identity = orlandoIdentityByParkId(parkId);
    const externalId = identity?.queueTimesId;
    if (!externalId) {
      rows.push({ parkId, error: "missing_queue_times_id" });
      continue;
    }
    const started = Date.now();
    try {
      const live = await provider.fetchLiveAttractions(externalId);
      const sample = live[0] ?? null;
      rows.push({
        provider: provider.providerId,
        parkId,
        providerParkId: externalId,
        scheduleWindows: 0,
        scheduleSupported: provider.supportsSchedule,
        attractions: live.length,
        withPostedWait: live.filter((row) => row.waitMinutes != null).length,
        statuses: [...new Set(live.map((row) => row.operatingStatus))],
        sampleObservedAt: sample?.meta.observedAt ?? null,
        sampleFreshness: sample
          ? classifyFreshness({
              observedAt: sample.meta.observedAt,
              fetchedAt: sample.meta.fetchedAt,
              staleAfter: sample.meta.staleAfter,
              now,
            })
          : "UNKNOWN",
        durationMs: Date.now() - started,
      });
    } catch (err) {
      rows.push({
        provider: provider.providerId,
        parkId,
        providerParkId: externalId,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - started,
      });
    }
  }
  return rows;
}

async function main() {
  const provider = argProvider();
  const rows =
    provider === PROVIDER_QUEUE_TIMES
      ? await checkQueueTimes()
      : await checkThemeParksWiki();
  console.log(JSON.stringify({ provider, checkedAt: new Date().toISOString(), rows }, null, 2));
  if (rows.some((row) => "error" in row && row.error)) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
