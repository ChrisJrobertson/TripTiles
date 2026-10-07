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
import {
  mappingAllowsOperationalUse,
  mappingIsVerified,
  normaliseMatchStatus,
  resolveEntityMapping,
} from "@/lib/park-data/mapping";
import {
  ORLANDO_HEADLINE_PARK_IDS,
  ORLANDO_PARK_IDENTITIES,
} from "@/lib/park-data/orlando-parks";
import { buildOrlandoCoverageReport } from "@/lib/park-data/orlando-report";
import {
  hhmmToMinutes,
  isValidExtendedParkTime,
  parkLocalHHmm,
  resolveOperatingWindow,
  sequencerMinutesFromResolution,
} from "@/lib/park-data/schedule";
import { operatingWindowForSequencer } from "@/lib/park-data/sequencer-hours";
import {
  clearThemeParksWikiDocumentCache,
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
        provenanceKind: "PROVIDER_OBSERVATION",
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
        provenanceKind: "PROVIDER_OBSERVATION",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: "Early Entry",
      },
    ],
  });
  assert.equal(posted.source, "posted_schedule");
  assert.equal(posted.provenanceKind, "PROVIDER_OBSERVATION");
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
        provenanceKind: "PROVIDER_OBSERVATION",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: "Special Ticketed Event",
      },
    ],
  });
  assert.equal(unpublished.source, "unknown");
  assert.equal(unpublished.provenanceKind, "PROVIDER_OBSERVATION");
  assert.equal(unpublished.open, null);
  assert.equal(sequencerMinutesFromResolution(unpublished, { hasEarlyEntry: false }), null);

  const primaryLive = chooseObservation(
    [
      {
        provider: "themeparks_wiki",
        freshness: "LIVE" as const,
        waitMinutes: 20,
        isOpen: true,
        operatingStatus: "open",
      },
      {
        provider: "queue_times",
        freshness: "LIVE" as const,
        waitMinutes: 50,
        isOpen: true,
        operatingStatus: "open",
      },
    ],
    "themeparks_wiki",
    "queue_times",
  );
  assert.match(primaryLive.reason, /^primary_live/);
  assert.equal(primaryLive.row?.waitMinutes, 20);
  assert.equal(primaryLive.conflicts.length, 1);

  const fallbackLive = chooseObservation(
    [
      {
        provider: "queue_times",
        freshness: "LIVE" as const,
        waitMinutes: 15,
        isOpen: true,
      },
    ],
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
        provenanceKind: "PROVIDER_OBSERVATION",
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

  // --- Hardening: mapping provenance ---
  assert.equal(normaliseMatchStatus(null), "legacy_unverified");
  assert.equal(normaliseMatchStatus(""), "legacy_unverified");
  assert.equal(mappingAllowsOperationalUse(null), true);
  assert.equal(mappingAllowsOperationalUse("legacy_unverified"), true);
  assert.equal(mappingIsVerified(null), false);
  assert.equal(mappingIsVerified("legacy_unverified"), false);
  assert.equal(mappingIsVerified("manually_approved"), true);
  assert.equal(mappingIsVerified("confirmed_exact"), true);
  assert.equal(mappingAllowsOperationalUse("candidate"), false);
  assert.equal(mappingAllowsOperationalUse("ambiguous"), false);

  const legacyMapped = resolveEntityMapping(
    [
      {
        provider: "queue_times",
        externalId: "6",
        triptilesId: "mk",
        matchStatus: null,
      },
    ],
    "queue_times",
    "6",
  );
  assert.equal(legacyMapped.outcome, "mapped");
  if (legacyMapped.outcome === "mapped") {
    assert.equal(legacyMapped.matchStatus, "legacy_unverified");
    assert.equal(legacyMapped.verified, false);
  }

  const migrationSql = readFileSync(
    new URL("../../../supabase/migrations/20261006140000_orlando_intelligence_foundation.sql", import.meta.url),
    "utf8",
  );
  assert.match(migrationSql, /default 'legacy_unverified'/);
  assert.equal(migrationSql.includes("default 'manually_approved'"), false);
  assert.match(migrationSql, /legacy_unverified/);
  assert.match(migrationSql, /PROVIDER_OBSERVATION/);
  assert.match(migrationSql, /OFFICIAL_FACT/);
  assert.equal(migrationSql.includes("AUTHORITATIVE_FACT"), false);
  assert.match(migrationSql, /\(\?:0\\d\|1\\d\|2\\d\|30\):\[0-5]\\d/);

  // --- Overnight / invalid times ---
  for (const ok of ["09:00", "23:30", "24:30", "25:00", "26:00", "30:00"]) {
    assert.equal(isValidExtendedParkTime(ok), true, ok);
  }
  for (const bad of ["9:00", "25:99", "abc", "", " 09:00", "09:00 ", "99:00"]) {
    assert.equal(isValidExtendedParkTime(bad), false, bad);
    assert.equal(hhmmToMinutes(bad), null, bad);
  }

  const lateClose = resolveOperatingWindow({
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
        closesAt: "25:00",
        scheduleKind: "operating",
        timezone: "America/New_York",
        provenanceKind: "PROVIDER_OBSERVATION",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: null,
      },
    ],
  });
  assert.equal(lateClose.close, "25:00");
  assert.equal(lateClose.closeMinutes, 25 * 60);

  const closedDay = resolveOperatingWindow({
    date: "2026-10-06",
    preferredProvider: "themeparks_wiki",
    now: NOW,
    catalogue: { parkId: "mk", opensAt: "09:00", closesAt: "22:00", hoursKnown: true },
    schedules: [
      {
        parkId: "mk",
        provider: "themeparks_wiki",
        operatingDate: "2026-10-06",
        opensAt: null,
        closesAt: null,
        scheduleKind: "closed",
        timezone: "America/New_York",
        provenanceKind: "PROVIDER_OBSERVATION",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: "Closed",
      },
    ],
  });
  assert.equal(closedDay.source, "unknown");
  assert.match(closedDay.label, /closed/i);
  assert.equal(sequencerMinutesFromResolution(closedDay, { hasEarlyEntry: false }), null);

  // --- Provider conflict matrix ---
  const conflictOpenClosed = chooseObservation(
    [
      {
        provider: "themeparks_wiki",
        freshness: "LIVE" as const,
        waitMinutes: 35,
        isOpen: true,
        operatingStatus: "open",
        observedAt: "2026-10-06T17:50:00.000Z",
      },
      {
        provider: "queue_times",
        freshness: "LIVE" as const,
        waitMinutes: 0,
        isOpen: false,
        operatingStatus: "closed",
        observedAt: "2026-10-06T17:55:00.000Z",
      },
    ],
    "themeparks_wiki",
    "queue_times",
  );
  assert.equal(conflictOpenClosed.row?.provider, "themeparks_wiki");
  assert.equal(conflictOpenClosed.row?.waitMinutes, 35);
  assert.equal(conflictOpenClosed.row?.isOpen, true);
  assert.ok(conflictOpenClosed.conflictKinds.includes("wait"));
  assert.ok(conflictOpenClosed.conflictKinds.includes("open"));
  assert.match(conflictOpenClosed.reason, /conflict/);

  const stalePrimaryFreshFallback = chooseObservation(
    [
      {
        provider: "themeparks_wiki",
        freshness: "STALE" as const,
        waitMinutes: 10,
        isOpen: true,
      },
      {
        provider: "queue_times",
        freshness: "LIVE" as const,
        waitMinutes: 40,
        isOpen: true,
      },
    ],
    "themeparks_wiki",
    "queue_times",
  );
  assert.equal(stalePrimaryFreshFallback.row?.provider, "queue_times");
  assert.match(stalePrimaryFreshFallback.reason, /^fallback_live/);

  const preferredOlderStillLive = chooseObservation(
    [
      {
        provider: "themeparks_wiki",
        freshness: "LIVE" as const,
        waitMinutes: 12,
        observedAt: "2026-10-06T17:40:00.000Z",
      },
      {
        provider: "queue_times",
        freshness: "LIVE" as const,
        waitMinutes: 99,
        observedAt: "2026-10-06T17:55:00.000Z",
      },
    ],
    "themeparks_wiki",
    "queue_times",
  );
  assert.equal(preferredOlderStillLive.row?.provider, "themeparks_wiki");

  const bothStale = chooseObservation(
    [
      { provider: "themeparks_wiki", freshness: "STALE" as const, waitMinutes: 1 },
      { provider: "queue_times", freshness: "STALE" as const, waitMinutes: 2 },
    ],
    "themeparks_wiki",
    "queue_times",
  );
  assert.equal(bothStale.row?.provider, "themeparks_wiki");
  assert.match(bothStale.reason, /^primary_stale/);

  const bothUnavailable = chooseObservation([], "themeparks_wiki", "queue_times");
  assert.equal(bothUnavailable.row, null);

  // --- Sequencer clock cases ---
  const shortened = operatingWindowForSequencer({
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
        closesAt: "16:00",
        scheduleKind: "operating",
        timezone: "America/New_York",
        provenanceKind: "PROVIDER_OBSERVATION",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: null,
      },
    ],
  });
  assert.equal(shortened.openMinutes, 10 * 60);
  assert.equal(shortened.closeMinutes, 16 * 60);

  const blockedClosed = operatingWindowForSequencer({
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
        opensAt: null,
        closesAt: null,
        scheduleKind: "closed",
        timezone: "America/New_York",
        provenanceKind: "PROVIDER_OBSERVATION",
        observedAt: "2026-10-06T12:00:00.000Z",
        fetchedAt: "2026-10-06T12:00:00.000Z",
        staleAfter: "2026-10-07T00:00:00.000Z",
        description: null,
      },
    ],
  });
  assert.equal(blockedClosed.blocked, true);

  const fallbackClock = operatingWindowForSequencer({
    parkIds: ["mk"],
    date: "2026-10-06",
    preferredProvider: "themeparks_wiki",
    hasEarlyEntry: false,
    now: NOW,
    catalogues: [{ parkId: "mk", opensAt: "08:00", closesAt: "23:00", hoursKnown: false }],
    schedules: [],
  });
  assert.equal(fallbackClock.blocked, false);
  assert.equal(fallbackClock.resolution.source, "fallback_assumption");
  assert.equal(fallbackClock.resolution.provenanceKind, "FALLBACK_ASSUMPTION");
  assert.ok(fallbackClock.warnings.some((w) => /Not a confirmed operating time/.test(w)));

  const catalogueClock = operatingWindowForSequencer({
    parkIds: ["mk"],
    date: "2026-10-06",
    preferredProvider: "themeparks_wiki",
    hasEarlyEntry: false,
    now: NOW,
    catalogues: [{ parkId: "mk", opensAt: "08:00", closesAt: "23:00", hoursKnown: true }],
    schedules: [],
  });
  assert.equal(catalogueClock.resolution.source, "catalogue_hours");
  assert.equal(catalogueClock.resolution.provenanceKind, "TRIPTILES_RULE");

  // --- Smart Plan labels stay honest ---
  const aiSource = readFileSync(new URL("../../actions/ai.ts", import.meta.url), "utf8");
  assert.match(aiSource, /fallback-assumption/);
  assert.match(aiSource, /Do not invent a different open or close/);
  assert.equal(aiSource.includes("assume 09:00 open and 22:00 close"), false);

  const scheduleNorm = normaliseThemeParksSchedule({
    fetchedAt: NOW.toISOString(),
    staleAfter: "2026-10-07T00:00:00.000Z",
    payload: {
      id: "park",
      timezone: "America/New_York",
      schedule: [
        {
          date: "2026-10-06",
          type: "OPERATING",
          openingTime: "2026-10-06T09:00:00-04:00",
          closingTime: "2026-10-06T22:00:00-04:00",
        },
      ],
    },
  });
  assert.equal(scheduleNorm[0]?.meta.provenanceKind, "PROVIDER_OBSERVATION");

  const oldObservation = normaliseThemeParksLive({
    providerParkId: "park-1",
    fetchedAt: NOW.toISOString(),
    staleAfter: "2026-10-06T18:15:00.000Z",
    staleAfterMinutes: 15,
    payload: {
      liveData: [
        {
          id: "old-ride",
          name: "Old Ride",
          entityType: "ATTRACTION",
          status: "CLOSED",
          lastUpdated: "2026-04-18T10:02:03.101Z",
          queue: { STANDBY: { waitTime: null } },
        },
      ],
    },
  });
  assert.equal(
    classifyFreshness({
      observedAt: oldObservation[0]!.meta.observedAt,
      fetchedAt: oldObservation[0]!.meta.fetchedAt,
      staleAfter: oldObservation[0]!.meta.staleAfter,
      now: NOW,
    }),
    "STALE",
  );

  clearThemeParksWikiDocumentCache();
  let etagCalls = 0;
  const etagProvider = createThemeParksWikiProvider({
    now: () => NOW,
    fetchImpl: async (_url, init) => {
      etagCalls += 1;
      const headers = new Headers(init?.headers);
      if (headers.get("If-None-Match") === 'W/"abc"') {
        return new Response(null, { status: 304, headers: { ETag: 'W/"abc"' } });
      }
      return response(livePayload(), 200, { ETag: 'W/"abc"' });
    },
  });
  const first = await etagProvider.fetchLiveAttractions("park-1");
  const second = await etagProvider.fetchLiveAttractions("park-1");
  assert.equal(first.length, second.length);
  assert.equal(etagCalls, 2);

  console.log("orlando intelligence tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
