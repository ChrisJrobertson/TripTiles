/**
 * Run: npx tsx src/lib/park-data/orlando-intelligence.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { generateParkDaySequence } from "@/lib/day-sequencer/engine";
import type { GenerateParkDaySequenceInput } from "@/lib/day-sequencer/types";
import { dedupeLiveStates } from "@/lib/park-data/dedupe-live";
import { providerMayOverwrite } from "@/lib/park-data/field-ownership";
import { classifyFreshness, freshnessAllowsLiveDescription } from "@/lib/park-data/freshness";
import { chooseObservation, fetchWithFallback } from "@/lib/park-data/live-selection";
import { resolveEntityMapping } from "@/lib/park-data/mapping";
import {
  ORLANDO_HEADLINE_PARK_IDS,
  ORLANDO_PARK_IDENTITIES,
} from "@/lib/park-data/orlando-parks";
import { buildOrlandoCoverageReport } from "@/lib/park-data/orlando-report";
import {
  hhmmToMinutes,
  parkLocalHHmm,
  resolveOperatingWindow,
  sequencerMinutesFromResolution,
} from "@/lib/park-data/schedule";
import { operatingWindowForSequencer } from "@/lib/park-data/sequencer-hours";
import {
  createThemeParksWikiProvider,
  normaliseThemeParksLive,
  normaliseThemeParksSchedule,
} from "@/lib/park-data/providers/themeparks-wiki";
import { ParkProviderError } from "@/lib/park-data/types";
import type { Attraction, TripRidePriority } from "@/types/attractions";

const NOW = new Date("2026-10-06T18:00:00.000Z");

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function livePayload() {
  return {
    id: "75ea578a-adc8-4116-a54d-dccb60765ef9",
    name: "Magic Kingdom Park",
    timezone: "America/New_York",
    liveData: [
      {
        id: "ride-1",
        name: "Space Mountain",
        entityType: "ATTRACTION",
        status: "OPERATING",
        lastUpdated: "2026-10-06T17:50:00.000Z",
        queue: { STANDBY: { waitTime: 45 } },
      },
      {
        id: "ride-2",
        name: "Haunted Mansion",
        entityType: "ATTRACTION",
        status: "OPERATING",
        lastUpdated: "2026-10-06T17:50:00.000Z",
        queue: { STANDBY: { waitTime: null } },
      },
      {
        id: "show-1",
        name: "Parade",
        entityType: "SHOW",
        status: "OPERATING",
      },
      {
        name: "Missing id",
        entityType: "ATTRACTION",
        status: "OPERATING",
      },
      {
        id: "ride-3",
        name: "Broken status",
        entityType: "ATTRACTION",
        status: "FOOBAR",
        queue: {},
      },
    ],
  };
}

function attraction(): Attraction {
  return {
    id: "mk-space",
    park_id: "mk",
    name: "Space Mountain",
    category: "ride",
    height_requirement_cm: null,
    height_requirement_accompanied_cm: null,
    min_age_years: null,
    thrill_level: "thrilling",
    is_indoor: true,
    duration_minutes: 5,
    skip_line_system: "none",
    skip_line_tier: null,
    skip_line_notes: null,
    avg_wait_peak_minutes: 10,
    avg_wait_offpeak_minutes: 10,
    best_time_to_ride: null,
    sort_order: 1,
    is_seasonal: false,
    is_temporarily_closed: false,
    closure_note: null,
    tags: [],
    official_url: null,
    virtual_queue: null,
    typical_closure_weeks: null,
    verification_status: "partial",
    verified_at: null,
    verified_by: null,
    source_url: null,
  };
}

function priority(): TripRidePriority {
  return {
    id: "p1",
    trip_id: "trip",
    attraction_id: "mk-space",
    day_date: "2026-10-06",
    priority: "must_do",
    sort_order: 1,
    notes: null,
    skip_line_return_hhmm: null,
    pasted_queue_minutes: null,
    created_at: "2026-10-06T00:00:00.000Z",
  };
}

function sequenceAt(openMinutes: number, closeMinutes: number) {
  const ride = attraction();
  const input: GenerateParkDaySequenceInput = {
    date: "2026-10-06",
    park_ids: ["mk"],
    entitlements: {
      has_lightning_lane_multi_pass: false,
      has_lightning_lane_single_pass: false,
      has_express_pass: false,
      has_early_entry: false,
    },
    pace: "balanced",
    young_child_party_v1: false,
    date_is_peak_season: false,
    park_open_minutes: openMinutes,
    park_close_minutes: closeMinutes,
    anchors: [],
    priorities: [priority()],
    attractions_by_id: { "mk-space": ride },
  };
  const result = generateParkDaySequence(input);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("sequence failed");
  const first = result.output.sequence.find((item) => item.type === "ride");
  assert.ok(first && first.type === "ride");
  return first.time_estimate;
}

async function run() {
  {
    const rows = normaliseThemeParksLive({
      providerParkId: "park-1",
      payload: livePayload(),
      fetchedAt: "2026-10-06T18:00:00.000Z",
      staleAfter: "2026-10-06T18:15:00.000Z",
    });
    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.waitMinutes, 45);
    assert.equal(rows[1]?.waitMinutes, null);
    assert.equal(rows[2]?.operatingStatus, "unknown");
    assert.equal(rows[2]?.isOpen, false);
  }

  assert.throws(
    () =>
      normaliseThemeParksLive({
        providerParkId: "park-1",
        payload: { liveData: "nope" },
        fetchedAt: NOW.toISOString(),
        staleAfter: NOW.toISOString(),
      }),
    (err: unknown) => err instanceof ParkProviderError && err.code === "invalid_payload",
  );

  {
    const windows = normaliseThemeParksSchedule({
      payload: {
        id: "park-1",
        timezone: "America/New_York",
        schedule: [
          {
            date: "2026-10-06",
            type: "TICKETED_EVENT",
            description: "Early Entry",
            openingTime: "2026-10-06T08:30:00-04:00",
            closingTime: "2026-10-06T09:00:00-04:00",
          },
          {
            date: "2026-10-06",
            type: "OPERATING",
            openingTime: "2026-10-06T09:00:00-04:00",
            closingTime: "2026-10-06T18:00:00-04:00",
          },
          {
            date: "2026-10-06",
            type: "OPERATING",
            openingTime: "not-a-time",
            closingTime: "2026-10-06T18:00:00-04:00",
          },
          {
            date: "2026-10-07",
            type: "OPERATING",
            openingTime: "2026-10-07T22:00:00-04:00",
            closingTime: "2026-10-08T01:00:00-04:00",
          },
        ],
      },
      fetchedAt: "2026-10-06T12:00:00.000Z",
      staleAfter: "2026-10-07T00:00:00.000Z",
    });
    assert.equal(windows[0]?.scheduleKind, "early_entry");
    assert.equal(windows[0]?.opensAt, "08:30");
    assert.equal(windows[1]?.opensAt, "09:00");
    assert.equal(windows[1]?.closesAt, "18:00");
    assert.equal(windows[2]?.opensAt, "22:00");
    assert.equal(windows[2]?.closesAt, "25:00");
    assert.equal(parkLocalHHmm("2026-10-07T00:00:00-04:00", "2026-10-06"), "24:00");
  }

  {
    let calls = 0;
    const provider = createThemeParksWikiProvider({
      apiKey: null,
      now: () => NOW,
      fetchImpl: async (url) => {
        calls += 1;
        if (String(url).includes("/live")) return response(livePayload());
        if (String(url).includes("/schedule")) {
          return response({ schedule: [], timezone: "America/New_York" });
        }
        return response({ destinations: [] });
      },
    });
    const live = await provider.fetchLiveAttractions("park-1");
    assert.equal(live[0]?.meta.provider, "themeparks_wiki");
    assert.equal(live[0]?.meta.provenanceKind, "LIVE_OBSERVATION");
    const schedule = await provider.fetchSchedule("park-1");
    assert.deepEqual(schedule, []);
    assert.ok(calls >= 2);
  }

  {
    const provider = createThemeParksWikiProvider({
      apiKey: null,
      fetchImpl: async () => response("not-json", 200),
    });
    await assert.rejects(
      () => provider.fetchLiveAttractions("park-1"),
      (err: unknown) => err instanceof ParkProviderError && err.code === "invalid_json",
    );
  }

  {
    const provider = createThemeParksWikiProvider({
      apiKey: null,
      fetchImpl: async () => response({ error: true }, 503),
    });
    await assert.rejects(
      () => provider.fetchSchedule("park-1"),
      (err: unknown) => err instanceof ParkProviderError && err.code === "http" && err.status === 503,
    );
  }

  {
    const provider = createThemeParksWikiProvider({
      apiKey: null,
      fetchImpl: async () => {
        throw Object.assign(new Error("aborted"), { name: "AbortError" });
      },
    });
    await assert.rejects(
      () => provider.fetchLiveAttractions("park-1"),
      (err: unknown) => err instanceof ParkProviderError && err.code === "timeout",
    );
  }

  {
    let calls = 0;
    const provider = createThemeParksWikiProvider({
      apiKey: null,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return response({}, 429, { "retry-after": "0" });
        return response(livePayload());
      },
    });
    const rows = await provider.fetchLiveAttractions("park-1");
    assert.equal(rows.length, 3);
    assert.equal(calls, 2);
  }

  assert.equal(
    resolveEntityMapping(
      [
        {
          provider: "themeparks_wiki",
          externalId: "ride-1",
          triptilesId: "mk-space",
          matchStatus: "confirmed_exact",
        },
      ],
      "themeparks_wiki",
      "ride-1",
    ).outcome,
    "mapped",
  );
  assert.equal(
    resolveEntityMapping([], "themeparks_wiki", "missing-ride").outcome,
    "unmapped",
  );
  assert.equal(
    resolveEntityMapping(
      [
        {
          provider: "queue_times",
          externalId: "old",
          triptilesId: "mk-splash",
          matchStatus: "retired",
        },
      ],
      "queue_times",
      "old",
    ).outcome,
    "retired",
  );
  assert.equal(
    resolveEntityMapping(
      [
        {
          provider: "themeparks_wiki",
          externalId: "same-name",
          triptilesId: "mk-space",
          matchStatus: "confirmed_exact",
        },
        {
          provider: "themeparks_wiki",
          externalId: "same-name",
          triptilesId: "dl-space",
          matchStatus: "manually_approved",
        },
      ],
      "themeparks_wiki",
      "same-name",
    ).outcome,
    "ambiguous",
  );
  assert.equal(
    resolveEntityMapping(
      [
        {
          provider: "themeparks_wiki",
          externalId: "maybe",
          triptilesId: "mk-space",
          matchStatus: "candidate",
        },
      ],
      "themeparks_wiki",
      "maybe",
    ).outcome,
    "candidate",
  );

  const observed = "2026-10-06T17:50:00.000Z";
  assert.equal(
    classifyFreshness({
      observedAt: observed,
      fetchedAt: "2026-10-06T17:55:00.000Z",
      staleAfter: "2026-10-06T18:05:00.000Z",
      now: NOW,
    }),
    "LIVE",
  );
  assert.equal(freshnessAllowsLiveDescription("LIVE"), true);
  assert.equal(freshnessAllowsLiveDescription("RECENT"), false);
  assert.equal(
    classifyFreshness({
      observedAt: "2026-10-06T16:00:00.000Z",
      fetchedAt: "2026-10-06T16:01:00.000Z",
      staleAfter: "2026-10-06T16:16:00.000Z",
      now: NOW,
    }),
    "RECENT",
  );
  assert.equal(
    classifyFreshness({
      observedAt: "2026-10-05T10:00:00.000Z",
      fetchedAt: "2026-10-05T10:01:00.000Z",
      staleAfter: "2026-10-05T10:16:00.000Z",
      now: NOW,
    }),
    "STALE",
  );
  assert.equal(
    classifyFreshness({ observedAt: null, staleAfter: null, now: NOW }),
    "UNKNOWN",
  );

  const posted = resolveOperatingWindow({
    date: "2026-10-06",
    preferredProvider: "themeparks_wiki",
    now: NOW,
    catalogue: null,
    schedules: [
      {
        parkId: "mk",
        provider: "themeparks_wiki",
        operatingDate: "2026-10-06",
        opensAt: "09:00",
        closesAt: "18:00",
        scheduleKind: "operating",
        timezone: "America/New_York",
        provenanceKind: "AUTHORITATIVE_FACT",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: null,
      },
      {
        parkId: "mk",
        provider: "themeparks_wiki",
        operatingDate: "2026-10-06",
        opensAt: "08:30",
        closesAt: "09:00",
        scheduleKind: "early_entry",
        timezone: "America/New_York",
        provenanceKind: "AUTHORITATIVE_FACT",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: "Early Entry",
      },
    ],
  });
  assert.equal(posted.source, "authoritative_schedule");
  assert.equal(posted.open, "09:00");
  assert.equal(posted.close, "18:00");
  const withEarly = sequencerMinutesFromResolution(posted, { hasEarlyEntry: true });
  assert.equal(withEarly?.openMinutes, hhmmToMinutes("08:30"));
  const withoutEarly = sequencerMinutesFromResolution(posted, { hasEarlyEntry: false });
  assert.equal(withoutEarly?.openMinutes, hhmmToMinutes("09:00"));

  const missing = resolveOperatingWindow({
    date: "2026-10-06",
    preferredProvider: "themeparks_wiki",
    now: NOW,
    catalogue: { parkId: "mk", opensAt: "08:00", closesAt: "23:00", hoursKnown: false },
    schedules: [],
  });
  assert.equal(missing.source, "fallback_assumption");
  assert.equal(missing.provenanceKind, "FALLBACK_ASSUMPTION");
  assert.match(missing.label, /Not a confirmed operating time/);
  assert.equal(missing.open, "09:00");

  const catalogue = resolveOperatingWindow({
    date: "2026-10-06",
    preferredProvider: "themeparks_wiki",
    now: NOW,
    catalogue: { parkId: "mk", opensAt: "08:00", closesAt: "23:00", hoursKnown: true },
    schedules: [],
  });
  assert.equal(catalogue.source, "catalogue_hours");
  assert.equal(catalogue.open, "08:00");

  const unpublished = resolveOperatingWindow({
    date: "2026-10-06",
    preferredProvider: "themeparks_wiki",
    now: NOW,
    catalogue: { parkId: "mk", opensAt: "09:00", closesAt: "22:00", hoursKnown: true },
    schedules: [
      {
        parkId: "mk",
        provider: "themeparks_wiki",
        operatingDate: "2026-10-06",
        opensAt: "19:00",
        closesAt: "24:00",
        scheduleKind: "special",
        timezone: "America/New_York",
        provenanceKind: "AUTHORITATIVE_FACT",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: "Special Ticketed Event",
      },
    ],
  });
  assert.equal(unpublished.source, "unknown");
  assert.equal(unpublished.open, null);
  assert.equal(sequencerMinutesFromResolution(unpublished, { hasEarlyEntry: false }), null);

  const primaryLive = chooseObservation(
    [
      { provider: "themeparks_wiki", freshness: "LIVE" as const, wait: 20 },
      { provider: "queue_times", freshness: "LIVE" as const, wait: 50 },
    ],
    "themeparks_wiki",
    "queue_times",
  );
  assert.equal(primaryLive.reason, "primary_live");
  assert.equal(primaryLive.row?.wait, 20);

  const fallbackLive = chooseObservation(
    [{ provider: "queue_times", freshness: "LIVE" as const, wait: 15 }],
    "themeparks_wiki",
    "queue_times",
  );
  assert.equal(fallbackLive.reason, "fallback_live");

  const none = chooseObservation([], "themeparks_wiki", "queue_times");
  assert.equal(none.row, null);
  assert.equal(none.reason, "no_data");

  const primaryFails = await fetchWithFallback({
    primary: async () => {
      throw new Error("timeout");
    },
    fallback: async () => ({ wait: 12 }),
  });
  assert.equal(primaryFails.source, "fallback");
  assert.deepEqual(primaryFails.value, { wait: 12 });

  const bothFail = await fetchWithFallback({
    primary: async () => {
      throw new Error("down");
    },
    fallback: async () => {
      throw new Error("also down");
    },
  });
  assert.equal(bothFail.value, null);
  assert.equal(bothFail.source, "none");

  const deduped = dedupeLiveStates([
    {
      providerParkId: "p",
      providerAttractionId: "a",
      name: "A",
      operatingStatus: "open",
      isOpen: true,
      waitMinutes: 10,
      meta: {
        provider: "themeparks_wiki",
        sourceId: "a",
        fetchedAt: NOW.toISOString(),
        observedAt: NOW.toISOString(),
        staleAfter: NOW.toISOString(),
        confidence: null,
        provenanceKind: "LIVE_OBSERVATION",
      },
      rawPayload: {},
    },
    {
      providerParkId: "p",
      providerAttractionId: "a",
      name: "A",
      operatingStatus: "open",
      isOpen: true,
      waitMinutes: 40,
      meta: {
        provider: "themeparks_wiki",
        sourceId: "a",
        fetchedAt: NOW.toISOString(),
        observedAt: NOW.toISOString(),
        staleAfter: NOW.toISOString(),
        confidence: null,
        provenanceKind: "LIVE_OBSERVATION",
      },
      rawPayload: {},
    },
  ]);
  assert.equal(deduped.rows.length, 0);
  assert.equal(deduped.duplicatesSkipped, 2);

  assert.equal(sequenceAt(9 * 60, 22 * 60), "09:00");
  assert.equal(sequenceAt(12 * 60, 20 * 60), "12:00");

  const clock = operatingWindowForSequencer({
    parkIds: ["mk"],
    date: "2026-10-06",
    preferredProvider: "themeparks_wiki",
    hasEarlyEntry: false,
    now: NOW,
    catalogues: [],
    schedules: [
      {
        parkId: "mk",
        provider: "themeparks_wiki",
        operatingDate: "2026-10-06",
        opensAt: "10:00",
        closesAt: "19:00",
        scheduleKind: "operating",
        timezone: "America/New_York",
        provenanceKind: "AUTHORITATIVE_FACT",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: null,
      },
    ],
  });
  assert.equal(clock.blocked, false);
  assert.equal(clock.openMinutes, 10 * 60);
  assert.equal(clock.closeMinutes, 19 * 60);

  const actionSource = readFileSync(new URL("../../actions/day-sequencer.ts", import.meta.url), "utf8");
  assert.equal(actionSource.includes("park_open_minutes: 540"), false);
  assert.equal(actionSource.includes("park_close_minutes: 1320"), false);
  assert.equal(actionSource.includes("operatingWindowForSequencer"), true);

  assert.equal(providerMayOverwrite("thrill_level"), false);
  assert.equal(providerMayOverwrite("latitude"), false);
  assert.equal(providerMayOverwrite("live_wait_minutes"), true);
  assert.equal(providerMayOverwrite("park_schedule"), true);

  assert.deepEqual(ORLANDO_HEADLINE_PARK_IDS, ["mk", "ep", "hs", "ak", "us", "ioa", "eu", "sw", "aq", "dc"]);
  const wikiIds = ORLANDO_PARK_IDENTITIES.map((park) => park.themeParksWikiId).filter(Boolean);
  assert.equal(new Set(wikiIds).size, wikiIds.length);
  const discovery = ORLANDO_PARK_IDENTITIES.find((park) => park.parkId === "dc");
  assert.equal(discovery?.queueTimesSupport, "unsupported");
  assert.ok(discovery?.themeParksWikiId);

  const coverage = buildOrlandoCoverageReport({
    now: NOW,
    today: "2026-10-06",
    primaryProvider: "themeparks_wiki",
    fallbackProvider: "queue_times",
    catalogues: [
      {
        parkId: "mk",
        name: "Magic Kingdom",
        latitude: null,
        longitude: null,
        officialUrl: null,
        timezoneSupported: false,
        attractionCount: 2,
        attractionsWithOfficialUrl: 1,
        attractionsWithHeight: 1,
        attractionsWithDuration: 2,
        attractionsWithThrill: 2,
        attractionsWithCategory: 2,
        attractionsWithSkipLine: 2,
        attractionsVerifiedOrPartial: 1,
        attractionsWithEvidence: 1,
        attractionsWithVerifiedAt: 0,
        indoorKnownCount: 0,
      },
    ],
    parkMappings: [
      {
        parkId: "mk",
        provider: "themeparks_wiki",
        externalParkId: "75ea578a-adc8-4116-a54d-dccb60765ef9",
        matchStatus: "confirmed_exact",
      },
      {
        parkId: "mk",
        provider: "themeparks_wiki",
        externalParkId: "other-id",
        matchStatus: "confirmed_exact",
      },
    ],
    attractionMappings: [],
    live: [],
    schedules: [],
    fetchLog: [],
  });
  const magic = coverage.parks.find((park) => park.parkId === "mk");
  assert.equal(magic?.themeParksWiki, "conflicting");
  assert.equal(magic?.fields.find((field) => field.field === "latitude")?.status, "missing");
  assert.equal(magic?.fields.find((field) => field.field === "land")?.status, "unsupported");
  assert.equal(coverage.parks.find((park) => park.parkId === "dc")?.queueTimes, "unsupported");

  console.log("orlando intelligence tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
