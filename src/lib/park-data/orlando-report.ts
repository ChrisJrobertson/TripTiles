import { classifyFreshness } from "@/lib/park-data/freshness";
import { mappingAllowsFactUse } from "@/lib/park-data/mapping";
import {
  ORLANDO_PARK_IDENTITIES,
  type OrlandoParkIdentity,
} from "@/lib/park-data/orlando-parks";
import { PROVIDER_QUEUE_TIMES, PROVIDER_THEMEPARKS_WIKI } from "@/lib/park-data/types";

export type CoverageStatus =
  | "complete"
  | "partial"
  | "missing"
  | "conflicting"
  | "stale"
  | "unsupported";

export type AuditField = {
  field: string;
  status: CoverageStatus;
  detail: string;
};

export type ParkMappingRow = {
  parkId: string | null;
  provider: string;
  externalParkId: string;
  matchStatus: string | null;
};

export type AttractionMappingRow = {
  parkId: string | null;
  provider: string;
  attractionId: string | null;
  externalParkId: string;
  externalAttractionId: string;
  matchStatus: string | null;
};

export type LiveObservationRow = {
  provider: string;
  parkId: string | null;
  attractionId: string | null;
  externalParkId: string;
  externalAttractionId: string;
  externalName: string | null;
  observedAt: string | null;
  fetchedAt: string | null;
  staleAfter: string | null;
};

export type ScheduleCoverageRow = {
  parkId: string | null;
  provider: string;
  operatingDate: string;
  scheduleKind: string;
  fetchedAt: string | null;
  staleAfter: string | null;
};

export type FetchLogRow = {
  provider: string;
  parkId: string | null;
  externalParkId: string | null;
  operation: string;
  ok: boolean;
  errorMessage: string | null;
  fetchedAt: string;
};

export type CatalogueParkSnapshot = {
  parkId: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  officialUrl: string | null;
  timezoneSupported: boolean;
  attractionCount: number;
  attractionsWithOfficialUrl: number;
  attractionsWithHeight: number;
  attractionsWithDuration: number;
  attractionsWithThrill: number;
  attractionsWithCategory: number;
  attractionsWithSkipLine: number;
  attractionsVerifiedOrPartial: number;
  attractionsWithEvidence: number;
  attractionsWithVerifiedAt: number;
  indoorKnownCount: number;
};

export type OrlandoReportInput = {
  now: Date;
  today: string;
  primaryProvider: string;
  fallbackProvider: string | null;
  catalogues: readonly CatalogueParkSnapshot[];
  parkMappings: readonly ParkMappingRow[];
  attractionMappings: readonly AttractionMappingRow[];
  live: readonly LiveObservationRow[];
  schedules: readonly ScheduleCoverageRow[];
  fetchLog: readonly FetchLogRow[];
};

export type OrlandoParkReport = {
  parkId: string;
  canonicalName: string;
  resort: string;
  headline: boolean;
  themeParksWiki: CoverageStatus;
  queueTimes: CoverageStatus;
  attractionCount: number;
  mappedToPrimary: number;
  mappedToFallback: number;
  unmapped: number;
  liveObservations: number;
  liveFreshness: "LIVE" | "RECENT" | "STALE" | "UNKNOWN";
  schedule: CoverageStatus;
  conflicts: string[];
  lastSuccessAt: string | null;
  lastError: string | null;
  fields: AuditField[];
  unmappedAttractions: {
    provider: string;
    externalParkId: string;
    externalAttractionId: string;
    externalName: string | null;
  }[];
};

function statusRank(status: CoverageStatus): number {
  if (status === "conflicting") return 5;
  if (status === "stale") return 4;
  if (status === "partial") return 3;
  if (status === "missing") return 2;
  if (status === "unsupported") return 1;
  return 0;
}

function worst(statuses: CoverageStatus[]): CoverageStatus {
  return [...statuses].sort((a, b) => statusRank(b) - statusRank(a))[0] ?? "missing";
}

function ratioStatus(have: number, total: number): CoverageStatus {
  if (total <= 0) return "missing";
  if (have <= 0) return "missing";
  if (have >= total) return "complete";
  return "partial";
}

function usableParkMappings(
  rows: readonly ParkMappingRow[],
  parkId: string,
  provider: string,
): ParkMappingRow[] {
  return rows.filter(
    (row) =>
      row.parkId === parkId &&
      row.provider === provider &&
      mappingAllowsFactUse(row.matchStatus) &&
      row.externalParkId.trim().length > 0,
  );
}

function providerMappingStatus(
  identity: OrlandoParkIdentity,
  rows: readonly ParkMappingRow[],
  provider: "themeparks_wiki" | "queue_times",
): CoverageStatus {
  const usable = usableParkMappings(rows, identity.parkId, provider);
  const ids = new Set(usable.map((row) => row.externalParkId));
  if (ids.size > 1) return "conflicting";
  if (ids.size === 1) return "complete";
  const candidates = rows.filter(
    (row) =>
      row.parkId === identity.parkId &&
      row.provider === provider &&
      row.matchStatus === "candidate",
  );
  if (candidates.length > 0) return "partial";
  if (provider === "queue_times" && identity.queueTimesSupport === "unsupported") {
    return "unsupported";
  }
  if (provider === "themeparks_wiki" && !identity.themeParksWikiId) return "unsupported";
  return "missing";
}

function mappedAttractionIds(
  rows: readonly AttractionMappingRow[],
  parkId: string,
  provider: string,
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.parkId !== parkId || row.provider !== provider) continue;
    if (!mappingAllowsFactUse(row.matchStatus)) continue;
    if (row.attractionId) ids.add(row.attractionId);
  }
  return ids;
}

function conflictsFor(
  identity: OrlandoParkIdentity,
  parkMappings: readonly ParkMappingRow[],
  attractionMappings: readonly AttractionMappingRow[],
): string[] {
  const notes: string[] = [];
  for (const provider of [PROVIDER_THEMEPARKS_WIKI, PROVIDER_QUEUE_TIMES]) {
    const ids = new Set(
      usableParkMappings(parkMappings, identity.parkId, provider).map((row) => row.externalParkId),
    );
    if (ids.size > 1) {
      notes.push(`${provider} has ${ids.size} usable park ids`);
    }
  }
  const ambiguous = attractionMappings.filter(
    (row) => row.parkId === identity.parkId && row.matchStatus === "ambiguous",
  );
  if (ambiguous.length > 0) {
    notes.push(`${ambiguous.length} ambiguous attraction mapping${ambiguous.length === 1 ? "" : "s"}`);
  }
  return notes;
}

function field(fieldName: string, status: CoverageStatus, detail: string): AuditField {
  return { field: fieldName, status, detail };
}

function auditFields(
  identity: OrlandoParkIdentity,
  catalogue: CatalogueParkSnapshot | null,
  scheduleStatus: CoverageStatus,
  liveFreshness: OrlandoParkReport["liveFreshness"],
  themeParksWiki: CoverageStatus,
  queueTimes: CoverageStatus,
): AuditField[] {
  const count = catalogue?.attractionCount ?? 0;
  return [
    field("triptiles_park_id", "complete", identity.parkId),
    field("canonical_name", "complete", identity.canonicalName),
    field("resort", "complete", identity.resort),
    field(
      "latitude",
      catalogue?.latitude == null ? "missing" : "complete",
      catalogue?.latitude == null
        ? "parks.latitude is empty. Provider coordinates stay on the mapping and are not copied."
        : "Catalogue latitude is present.",
    ),
    field(
      "longitude",
      catalogue?.longitude == null ? "missing" : "complete",
      catalogue?.longitude == null
        ? "parks.longitude is empty. Provider coordinates stay on the mapping and are not copied."
        : "Catalogue longitude is present.",
    ),
    field(
      "timezone",
      "unsupported",
      identity.providerTimezone
        ? `No parks.timezone column. Provider entity timezone is ${identity.providerTimezone}.`
        : "No parks.timezone column and no provider timezone was confirmed.",
    ),
    field(
      "official_url",
      catalogue?.officialUrl ? "complete" : "missing",
      catalogue?.officialUrl ? "Catalogue official URL is present." : "Catalogue official URL is empty.",
    ),
    field("themeparks_wiki_park_id", themeParksWiki, identity.themeParksWikiId ?? identity.note ?? "No confirmed id."),
    field("queue_times_park_id", queueTimes, identity.queueTimesId ?? identity.note ?? "No confirmed id."),
    field("operating_schedule", scheduleStatus, "Date-specific hours live in park_operating_schedules."),
    field(
      "live_wait",
      liveFreshness === "LIVE"
        ? "complete"
        : liveFreshness === "RECENT" || liveFreshness === "STALE"
          ? "stale"
          : "missing",
      `Park-level live freshness is ${liveFreshness}.`,
    ),
    field("attraction_count", count > 0 ? "complete" : "missing", `${count} catalogue attractions.`),
    field(
      "attraction_official_url",
      ratioStatus(catalogue?.attractionsWithOfficialUrl ?? 0, count),
      `${catalogue?.attractionsWithOfficialUrl ?? 0} of ${count} have an official URL.`,
    ),
    field(
      "land",
      "unsupported",
      "Attractions have no land/area column. Nothing was inferred.",
    ),
    field(
      "category",
      ratioStatus(catalogue?.attractionsWithCategory ?? 0, count),
      `${catalogue?.attractionsWithCategory ?? 0} of ${count} have a category.`,
    ),
    field(
      "minimum_height",
      ratioStatus(catalogue?.attractionsWithHeight ?? 0, count),
      `${catalogue?.attractionsWithHeight ?? 0} of ${count} have a height. Null means unknown, not unrestricted.`,
    ),
    field(
      "ride_duration",
      ratioStatus(catalogue?.attractionsWithDuration ?? 0, count),
      `${catalogue?.attractionsWithDuration ?? 0} of ${count} have a duration.`,
    ),
    field(
      "indoor_outdoor",
      catalogue?.indoorKnownCount
        ? ratioStatus(catalogue.indoorKnownCount, count)
        : "missing",
      "is_indoor defaults to false, so false alone is not evidence of an outdoor ride.",
    ),
    field(
      "thrill_level",
      ratioStatus(catalogue?.attractionsWithThrill ?? 0, count),
      `${catalogue?.attractionsWithThrill ?? 0} of ${count} have a TripTiles thrill level.`,
    ),
    field(
      "skip_line",
      ratioStatus(catalogue?.attractionsWithSkipLine ?? 0, count),
      `${catalogue?.attractionsWithSkipLine ?? 0} of ${count} have a skip-line system.`,
    ),
    field(
      "verification_status",
      ratioStatus(catalogue?.attractionsVerifiedOrPartial ?? 0, count),
      `${catalogue?.attractionsVerifiedOrPartial ?? 0} of ${count} are verified or partial.`,
    ),
    field(
      "evidence",
      ratioStatus(catalogue?.attractionsWithEvidence ?? 0, count),
      `${catalogue?.attractionsWithEvidence ?? 0} of ${count} have a source or official URL.`,
    ),
    field(
      "last_verified",
      ratioStatus(catalogue?.attractionsWithVerifiedAt ?? 0, count),
      `${catalogue?.attractionsWithVerifiedAt ?? 0} of ${count} have verified_at.`,
    ),
  ];
}

function summarise(fields: AuditField[]): CoverageStatus {
  return worst(fields.map((item) => item.status));
}

export function buildOrlandoCoverageReport(input: OrlandoReportInput): {
  parks: OrlandoParkReport[];
  summary: CoverageStatus;
} {
  const catalogues = new Map(input.catalogues.map((row) => [row.parkId, row]));
  const parks = ORLANDO_PARK_IDENTITIES.map((identity): OrlandoParkReport => {
    const themeParksWiki = providerMappingStatus(identity, input.parkMappings, "themeparks_wiki");
    const queueTimes = providerMappingStatus(identity, input.parkMappings, "queue_times");
    const primaryIds = mappedAttractionIds(input.attractionMappings, identity.parkId, input.primaryProvider);
    const fallbackIds = input.fallbackProvider
      ? mappedAttractionIds(input.attractionMappings, identity.parkId, input.fallbackProvider)
      : new Set<string>();
    const union = new Set([...primaryIds, ...fallbackIds]);
    const attractionCount = catalogues.get(identity.parkId)?.attractionCount ?? 0;
    const observations = input.live.filter((row) => row.parkId === identity.parkId);
    const freshnesses = observations.map((row) =>
      classifyFreshness({
        observedAt: row.observedAt,
        fetchedAt: row.fetchedAt,
        staleAfter: row.staleAfter,
        now: input.now,
      }),
    );
    const liveFreshness = freshnesses.includes("LIVE")
      ? "LIVE"
      : freshnesses.includes("RECENT")
        ? "RECENT"
        : freshnesses.includes("STALE")
          ? "STALE"
          : "UNKNOWN";
    const scheduleRows = input.schedules.filter(
      (row) => row.parkId === identity.parkId && row.operatingDate >= input.today,
    );
    const operating = scheduleRows.filter((row) => row.scheduleKind === "operating");
    let schedule: CoverageStatus = "missing";
    if (operating.length > 0) {
      const fresh = operating.some(
        (row) =>
          classifyFreshness({
            observedAt: row.fetchedAt,
            fetchedAt: row.fetchedAt,
            staleAfter: row.staleAfter,
            now: input.now,
          }) === "LIVE" ||
          classifyFreshness({
            observedAt: row.fetchedAt,
            fetchedAt: row.fetchedAt,
            staleAfter: row.staleAfter,
            now: input.now,
          }) === "RECENT",
      );
      schedule = fresh ? "complete" : "stale";
    } else if (scheduleRows.length > 0) {
      schedule = "partial";
    }
    const logs = input.fetchLog.filter(
      (row) => row.parkId === identity.parkId || row.externalParkId === identity.themeParksWikiId || row.externalParkId === identity.queueTimesId,
    );
    const success = logs.filter((row) => row.ok).sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0];
    const failure = logs.filter((row) => !row.ok).sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0];
    const unmappedAttractions = input.live
      .filter((row) => row.parkId === identity.parkId && !row.attractionId)
      .slice(0, 25)
      .map((row) => ({
        provider: row.provider,
        externalParkId: row.externalParkId,
        externalAttractionId: row.externalAttractionId,
        externalName: row.externalName,
      }));
    const fields = auditFields(
      identity,
      catalogues.get(identity.parkId) ?? null,
      schedule,
      liveFreshness,
      themeParksWiki,
      queueTimes,
    );
    return {
      parkId: identity.parkId,
      canonicalName: identity.canonicalName,
      resort: identity.resort,
      headline: identity.headline,
      themeParksWiki,
      queueTimes,
      attractionCount,
      mappedToPrimary: primaryIds.size,
      mappedToFallback: fallbackIds.size,
      unmapped: Math.max(0, attractionCount - union.size),
      liveObservations: observations.length,
      liveFreshness,
      schedule,
      conflicts: conflictsFor(identity, input.parkMappings, input.attractionMappings),
      lastSuccessAt: success?.fetchedAt ?? null,
      lastError: failure ? `${failure.provider} ${failure.operation}: ${failure.errorMessage ?? "failed"}` : null,
      fields,
      unmappedAttractions,
    };
  });

  return {
    parks,
    summary: worst(parks.filter((park) => park.headline).flatMap((park) => park.fields.map((item) => item.status))),
  };
}

export function repositoryOrlandoAudit(): AuditField[] {
  const empty: CatalogueParkSnapshot = {
    parkId: "",
    name: null,
    latitude: null,
    longitude: null,
    officialUrl: null,
    timezoneSupported: false,
    attractionCount: 0,
    attractionsWithOfficialUrl: 0,
    attractionsWithHeight: 0,
    attractionsWithDuration: 0,
    attractionsWithThrill: 0,
    attractionsWithCategory: 0,
    attractionsWithSkipLine: 0,
    attractionsVerifiedOrPartial: 0,
    attractionsWithEvidence: 0,
    attractionsWithVerifiedAt: 0,
    indoorKnownCount: 0,
  };
  const report = buildOrlandoCoverageReport({
    now: new Date("2026-10-06T12:00:00Z"),
    today: "2026-10-06",
    primaryProvider: PROVIDER_THEMEPARKS_WIKI,
    fallbackProvider: PROVIDER_QUEUE_TIMES,
    catalogues: ORLANDO_PARK_IDENTITIES.map((park) => ({ ...empty, parkId: park.parkId, name: park.canonicalName })),
    parkMappings: ORLANDO_PARK_IDENTITIES.flatMap((park) => {
      const rows: ParkMappingRow[] = [];
      if (park.themeParksWikiId) {
        rows.push({
          parkId: park.parkId,
          provider: PROVIDER_THEMEPARKS_WIKI,
          externalParkId: park.themeParksWikiId,
          matchStatus: "confirmed_exact",
        });
      }
      if (park.queueTimesId) {
        rows.push({
          parkId: park.parkId,
          provider: PROVIDER_QUEUE_TIMES,
          externalParkId: park.queueTimesId,
          matchStatus: "confirmed_exact",
        });
      }
      return rows;
    }),
    attractionMappings: [],
    live: [],
    schedules: [],
    fetchLog: [],
  });
  return report.parks.flatMap((park) =>
    park.fields.map((item) => ({
      ...item,
      field: `${park.parkId}.${item.field}`,
    })),
  );
}

export { summarise };
