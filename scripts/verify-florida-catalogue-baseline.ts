/**
 * Florida catalogue checksum: per-region row counts + SHA-256 over canonical row JSON
 * for built-in parks tied to orlando, florida_combo, or miami.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-florida-catalogue-baseline.ts
 *
 * Legacy (Orlando-only counts, same shape as the original verifier):
 *   node --env-file=.env.local --import tsx scripts/verify-florida-catalogue-baseline.ts --legacy-orlando-summary
 */
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FLORIDA_REGION_IDS = ["orlando", "florida_combo", "miami"] as const;

type TableSlice = { count: number; hash: string };

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) {
    out[k] = sortKeysDeep(o[k]);
  }
  return out;
}

function hashRows(rows: Record<string, unknown>[]): string {
  const normalized = [...rows]
    .map((r) => sortKeysDeep(r) as Record<string, unknown>)
    .sort((a, b) => {
      const ida = String(a.id ?? "");
      const idb = String(b.id ?? "");
      return ida.localeCompare(idb);
    });
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function anonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL and anon/publishable key");
  }
  return createClient(url, key);
}

const PAGE = 1000;

async function fetchParksForRegion(sb: SupabaseClient, regionId: string): Promise<Record<string, unknown>[]> {
  let offset = 0;
  const out: Record<string, unknown>[] = [];
  for (;;) {
    const { data, error } = await sb
      .from("parks")
      .select("*")
      .eq("is_custom", false)
      .contains("region_ids", [regionId])
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`parks: ${error.message}`);
    const batch = (data ?? []) as Record<string, unknown>[];
    out.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

async function fetchByParkIds(
  sb: SupabaseClient,
  table: "attractions" | "park_areas" | "park_briefings",
  parkIds: string[],
): Promise<Record<string, unknown>[]> {
  if (parkIds.length === 0) return [];
  const chunkSize = 80;
  const byId = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < parkIds.length; i += chunkSize) {
    const chunk = parkIds.slice(i, i + chunkSize);
    let offset = 0;
    for (;;) {
      const { data, error } = await sb
        .from(table)
        .select("*")
        .in("park_id", chunk)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      const batch = (data ?? []) as Record<string, unknown>[];
      for (const r of batch) {
        byId.set(String(r.id), r);
      }
      if (batch.length < PAGE) break;
      offset += PAGE;
    }
  }
  return [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

async function fetchRegionBriefingsForRegion(
  sb: SupabaseClient,
  regionId: string,
): Promise<Record<string, unknown>[]> {
  let offset = 0;
  const out: Record<string, unknown>[] = [];
  for (;;) {
    const { data, error } = await sb
      .from("region_briefings")
      .select("*")
      .eq("region_id", regionId)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`region_briefings: ${error.message}`);
    const batch = (data ?? []) as Record<string, unknown>[];
    out.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }
  return out;
}

export async function runLegacyOrlandoSummary(sb: SupabaseClient): Promise<void> {
  const parks = await fetchParksForRegion(sb, "orlando");
  const ids = parks.map((p) => String(p.id));
  const attractions = await fetchByParkIds(sb, "attractions", ids);
  console.log(
    JSON.stringify(
      {
        orlando_built_in_parks: ids.length,
        orlando_attractions: attractions.length,
      },
      null,
      2,
    ),
  );
}

async function runFloridaChecksum(sb: SupabaseClient): Promise<void> {
  const perRegion: Record<string, Record<string, TableSlice>> = {};

  for (const regionId of FLORIDA_REGION_IDS) {
    const parks = await fetchParksForRegion(sb, regionId);
    const parkIds = parks.map((p) => String(p.id));

    const [attractions, parkAreas, parkBriefings, regionBriefings] = await Promise.all([
      fetchByParkIds(sb, "attractions", parkIds),
      fetchByParkIds(sb, "park_areas", parkIds),
      fetchByParkIds(sb, "park_briefings", parkIds),
      fetchRegionBriefingsForRegion(sb, regionId),
    ]);

    perRegion[regionId] = {
      parks: { count: parks.length, hash: hashRows(parks) },
      attractions: { count: attractions.length, hash: hashRows(attractions) },
      park_areas: { count: parkAreas.length, hash: hashRows(parkAreas) },
      region_briefings: { count: regionBriefings.length, hash: hashRows(regionBriefings) },
      park_briefings: { count: parkBriefings.length, hash: hashRows(parkBriefings) },
    };
  }

  console.log(
    JSON.stringify(
      {
        florida_region_ids: [...FLORIDA_REGION_IDS],
        per_region: perRegion,
      },
      null,
      2,
    ),
  );
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entry);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const sb = anonClient();
  const legacy = process.argv.includes("--legacy-orlando-summary");
  if (legacy) {
    await runLegacyOrlandoSummary(sb);
    return;
  }
  await runFloridaChecksum(sb);
}

if (isMainModule()) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
