import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase/env";

const PROVIDER = "queue_times";
const QUEUE_TIMES_BASE_URL = "https://queue-times.com";
const FUZZY_THRESHOLD = 0.85;

const PARKS_TO_MAP = [
  { triptilesParkId: "hs", queueTimesId: 7, name: "Hollywood Studios" },
  { triptilesParkId: "ep", queueTimesId: 5, name: "EPCOT" },
  { triptilesParkId: "ak", queueTimesId: 8, name: "Animal Kingdom" },
  { triptilesParkId: "us", queueTimesId: 65, name: "Universal Studios Florida" },
  { triptilesParkId: "ioa", queueTimesId: 64, name: "Islands of Adventure" },
  { triptilesParkId: "eu", queueTimesId: 334, name: "Epic Universe" },
  { triptilesParkId: "dl", queueTimesId: 16, name: "Disneyland Park" },
  { triptilesParkId: "dca", queueTimesId: 17, name: "California Adventure" },
  { triptilesParkId: "dlp", queueTimesId: 4, name: "Disneyland Paris" },
  { triptilesParkId: "wdsp", queueTimesId: 28, name: "Walt Disney Studios" },
  { triptilesParkId: "hkdl", queueTimesId: 31, name: "Hong Kong Disneyland" },
] as const;

type ParkToMap = (typeof PARKS_TO_MAP)[number];

type QueueTimesRide = {
  id: number | string;
  name: string;
};

type QueueTimesParkResponse = {
  lands?: Array<{ rides?: QueueTimesRide[] | null }> | null;
  rides?: QueueTimesRide[] | null;
};

type AttractionRow = {
  id: string;
  name: string;
};

type MappingRow = {
  provider: string;
  external_park_id: string;
  external_attraction_id: string;
  park_id: string;
  attraction_id: string | null;
  external_name: string;
  mapping_confidence: number;
};

type ParkSummary = {
  park: ParkToMap;
  fetchedRides: number;
  matched: Array<{
    externalName: string;
    attractionId: string;
    attractionName: string;
    confidence: number;
  }>;
  unmatched: string[];
};

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !["the", "a", "of", "and"].includes(token))
    .join(" ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length] ?? 0;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - levenshtein(a, b) / maxLength;
}

function bestAttractionMatch(
  rideName: string,
  attractions: AttractionRow[],
): { attraction: AttractionRow; confidence: number } | null {
  const normalisedRide = normaliseName(rideName);
  if (!normalisedRide) return null;

  const exact = attractions
    .filter((attraction) => normaliseName(attraction.name) === normalisedRide)
    .sort((a, b) => b.id.length - a.id.length || a.id.localeCompare(b.id));
  if (exact[0]) return { attraction: exact[0], confidence: 1 };

  const ranked = attractions
    .map((attraction) => ({
      attraction,
      score: similarity(normalisedRide, normaliseName(attraction.name)),
    }))
    .filter((candidate) => candidate.score >= FUZZY_THRESHOLD)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.attraction.id.length - a.attraction.id.length ||
        a.attraction.id.localeCompare(b.attraction.id),
    );

  const best = ranked[0];
  if (!best) return null;
  return {
    attraction: best.attraction,
    confidence: Number(best.score.toFixed(3)),
  };
}

function flattenQueueTimesRides(data: QueueTimesParkResponse): QueueTimesRide[] {
  const byId = new Map<string, QueueTimesRide>();
  for (const ride of data.rides ?? []) {
    if (ride?.id == null || !ride.name) continue;
    byId.set(String(ride.id), ride);
  }
  for (const land of data.lands ?? []) {
    for (const ride of land.rides ?? []) {
      if (ride?.id == null || !ride.name) continue;
      byId.set(String(ride.id), ride);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchQueueTimesRides(park: ParkToMap): Promise<QueueTimesRide[]> {
  const response = await fetch(
    `${QUEUE_TIMES_BASE_URL}/parks/${park.queueTimesId}/queue_times.json`,
  );
  if (!response.ok) {
    throw new Error(
      `Queue-Times ${park.queueTimesId} failed: ${response.status} ${response.statusText}`,
    );
  }
  const data = (await response.json()) as QueueTimesParkResponse;
  return flattenQueueTimesRides(data);
}

function mappingKey(row: {
  provider: string;
  external_park_id: string;
  external_attraction_id: string;
}) {
  return `${row.provider}\t${row.external_park_id}\t${row.external_attraction_id}`;
}

async function main() {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with `.env.local` loaded.",
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const allRows: MappingRow[] = [];
  const summaries: ParkSummary[] = [];

  for (const park of PARKS_TO_MAP) {
    const [{ data: attractions, error }, rides] = await Promise.all([
      supabase
        .from("attractions")
        .select("id, name")
        .eq("park_id", park.triptilesParkId)
        .order("name", { ascending: true }),
      fetchQueueTimesRides(park),
    ]);

    if (error) throw new Error(`${park.triptilesParkId} attractions: ${error.message}`);

    const attractionRows = (attractions ?? []) as AttractionRow[];
    const summary: ParkSummary = {
      park,
      fetchedRides: rides.length,
      matched: [],
      unmatched: [],
    };

    allRows.push({
      provider: PROVIDER,
      external_park_id: String(park.queueTimesId),
      external_attraction_id: "",
      park_id: park.triptilesParkId,
      attraction_id: null,
      external_name: `${park.name} park link`,
      mapping_confidence: 1,
    });

    for (const ride of rides) {
      const match = bestAttractionMatch(ride.name, attractionRows);
      if (!match) {
        summary.unmatched.push(ride.name);
        continue;
      }

      allRows.push({
        provider: PROVIDER,
        external_park_id: String(park.queueTimesId),
        external_attraction_id: String(ride.id),
        park_id: park.triptilesParkId,
        attraction_id: match.attraction.id,
        external_name: ride.name,
        mapping_confidence: match.confidence,
      });
      summary.matched.push({
        externalName: ride.name,
        attractionId: match.attraction.id,
        attractionName: match.attraction.name,
        confidence: match.confidence,
      });
    }

    summaries.push(summary);
  }

  const externalParkIds = PARKS_TO_MAP.map((park) => String(park.queueTimesId));
  const { data: existing, error: existingError } = await supabase
    .from("live_wait_provider_mappings")
    .select("provider, external_park_id, external_attraction_id")
    .eq("provider", PROVIDER)
    .in("external_park_id", externalParkIds);
  if (existingError) {
    throw new Error(`existing mappings: ${existingError.message}`);
  }
  const existingKeys = new Set((existing ?? []).map((row) => mappingKey(row)));
  const rowsThatWillInsert = allRows.filter((row) => !existingKeys.has(mappingKey(row)));

  for (let i = 0; i < allRows.length; i += 200) {
    const slice = allRows.slice(i, i + 200);
    const { error } = await supabase
      .from("live_wait_provider_mappings")
      .upsert(slice, {
        onConflict: "provider,external_park_id,external_attraction_id",
      });
    if (error) throw new Error(`mapping upsert: ${error.message}`);
  }

  console.log("Live wait mapping seed summary");
  console.log(`Provider: ${PROVIDER}`);
  console.log(`Rows prepared: ${allRows.length}`);
  console.log(`Rows newly inserted (pre-upsert estimate): ${rowsThatWillInsert.length}`);
  console.log(`Rows updated/skipped by conflict: ${allRows.length - rowsThatWillInsert.length}`);
  console.log("");

  for (const summary of summaries) {
    console.log(
      `${summary.park.name} (${summary.park.triptilesParkId} / Queue-Times ${summary.park.queueTimesId})`,
    );
    console.log(
      `  fetched=${summary.fetchedRides}, matched=${summary.matched.length}, unmatched=${summary.unmatched.length}`,
    );
    if (summary.unmatched.length > 0) {
      console.log(`  unmatched: ${summary.unmatched.join("; ")}`);
    }
  }
}

main().catch((error) => {
  console.error("[seed-live-wait-mappings] Fatal:", error);
  process.exit(1);
});
