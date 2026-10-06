/**
 * One live ThemeParks.wiki read. Does not write to the database.
 *
 *   npx tsx scripts/park-data-live-check.ts
 */

import { createThemeParksWikiProvider } from "@/lib/park-data/providers/themeparks-wiki";

const MAGIC_KINGDOM = "75ea578a-adc8-4116-a54d-dccb60765ef9";

async function main() {
  const provider = createThemeParksWikiProvider({ apiKey: null });
  const [schedule, live] = await Promise.all([
    provider.fetchSchedule(MAGIC_KINGDOM),
    provider.fetchLiveAttractions(MAGIC_KINGDOM),
  ]);
  const operating = schedule.filter((row) => row.scheduleKind === "operating");
  console.log(
    JSON.stringify(
      {
        provider: provider.providerId,
        parkId: MAGIC_KINGDOM,
        scheduleWindows: schedule.length,
        operatingWindows: operating.length,
        firstOperating: operating[0]
          ? {
              date: operating[0].operatingDate,
              open: operating[0].opensAt,
              close: operating[0].closesAt,
            }
          : null,
        attractions: live.length,
        withPostedWait: live.filter((row) => row.waitMinutes != null).length,
        withoutPostedWait: live.filter((row) => row.waitMinutes == null).length,
        statuses: [...new Set(live.map((row) => row.operatingStatus))],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
