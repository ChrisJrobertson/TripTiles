import type { SupabaseClient } from "@supabase/supabase-js";

import type { LiveWaitOperatingStatus } from "@/types/live-wait";

export type LiveWaitUnmappedDiagnosticRow = {
  provider: string;
  externalParkId: string;
  externalAttractionId: string;
  externalName: string | null;
  waitMinutes: number | null;
  operatingStatus: LiveWaitOperatingStatus;
  isOpen: boolean;
  observedAt: string;
  fetchedAt: string;
  staleAfter: string | null;
  suggestions: AttractionCandidate[];
};

export type AttractionCandidate = {
  attractionId: string;
  name: string;
  score: number;
};

export type LiveWaitUnmappedGroup = {
  externalParkId: string;
  internalParkId: string | null;
  internalParkName: string | null;
  rows: LiveWaitUnmappedDiagnosticRow[];
};

function tokenize(name: string): Set<string> {
  const parts = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
  return new Set(parts);
}

/** Jaccard on word tokens + small boost for substring overlap (dependency-free). */
export function scoreNameSimilarity(a: string, b: string): number {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.88;
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) inter += 1;
  }
  const union = ta.size + tb.size - inter;
  return union > 0 ? inter / union : 0;
}

async function resolveInternalParkIdForExternal(
  supabase: SupabaseClient,
  provider: string,
  externalParkId: string,
): Promise<{ parkId: string | null; parkName: string | null }> {
  const { data: maps, error } = await supabase
    .from("live_wait_provider_mappings")
    .select("park_id")
    .eq("provider", provider)
    .eq("external_park_id", externalParkId)
    .not("park_id", "is", null)
    .limit(10);

  if (error) throw new Error(error.message);

  const first = (maps ?? []).find(
    (m: { park_id: string | null }) => typeof m.park_id === "string",
  ) as { park_id: string } | undefined;

  if (!first?.park_id) return { parkId: null, parkName: null };

  const { data: park } = await supabase
    .from("parks")
    .select("name")
    .eq("id", first.park_id)
    .maybeSingle();

  const parkName =
    park && typeof park === "object" && "name" in park
      ? String((park as { name: string }).name ?? "").trim() || null
      : null;

  return { parkId: first.park_id, parkName };
}

export async function suggestAttractionsForName(
  supabase: SupabaseClient,
  internalParkId: string,
  externalName: string,
  limit = 5,
): Promise<AttractionCandidate[]> {
  const { data: attractions, error } = await supabase
    .from("attractions")
    .select("id, name")
    .eq("park_id", internalParkId)
    .limit(400);

  if (error || !attractions?.length) return [];

  return (attractions as { id: string; name: string }[])
    .map((row) => ({
      attractionId: row.id,
      name: row.name,
      score: scoreNameSimilarity(externalName, row.name),
    }))
    .filter((r) => r.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Unmapped `live_wait_current` rows grouped by external park, with optional
 * same-park attraction suggestions (never crosses parks).
 */
export async function buildLiveWaitMappingDiagnostics(
  supabase: SupabaseClient,
  options?: { provider?: string; maxRows?: number },
): Promise<{ groups: LiveWaitUnmappedGroup[]; truncated: boolean }> {
  const provider = options?.provider?.trim() || "queue_times";
  const maxRows = options?.maxRows ?? 250;

  const { data: rows, error } = await supabase
    .from("live_wait_current")
    .select(
      "provider, external_park_id, external_attraction_id, external_name, wait_minutes, operating_status, is_open, observed_at, fetched_at, stale_after",
    )
    .eq("provider", provider)
    .is("attraction_id", null)
    .order("external_park_id", { ascending: true })
    .order("external_name", { ascending: true })
    .limit(maxRows + 1);

  if (error) throw new Error(error.message);

  const list = (rows ?? []) as Record<string, unknown>[];
  const truncated = list.length > maxRows;
  const slice = truncated ? list.slice(0, maxRows) : list;

  const baseRows: Omit<LiveWaitUnmappedDiagnosticRow, "suggestions">[] =
    slice.map((r) => ({
      provider: String(r.provider ?? provider),
      externalParkId: String(r.external_park_id ?? ""),
      externalAttractionId: String(r.external_attraction_id ?? ""),
      externalName:
        r.external_name == null ? null : String(r.external_name),
      waitMinutes:
        r.wait_minutes == null || r.wait_minutes === ""
          ? null
          : Number(r.wait_minutes),
      operatingStatus: String(
        r.operating_status ?? "unknown",
      ) as LiveWaitOperatingStatus,
      isOpen: Boolean(r.is_open),
      observedAt: String(r.observed_at ?? ""),
      fetchedAt: String(r.fetched_at ?? ""),
      staleAfter: r.stale_after == null ? null : String(r.stale_after),
    }));

  const byExtPark = new Map<string, typeof baseRows>();
  for (const row of baseRows) {
    const k = row.externalParkId;
    const arr = byExtPark.get(k) ?? [];
    arr.push(row);
    byExtPark.set(k, arr);
  }

  const groups: LiveWaitUnmappedGroup[] = [];

  for (const [externalParkId, groupRows] of byExtPark) {
    const { parkId, parkName } = await resolveInternalParkIdForExternal(
      supabase,
      provider,
      externalParkId,
    );

    groups.push({
      externalParkId,
      internalParkId: parkId,
      internalParkName: parkName,
      rows: groupRows.map((row) => ({ ...row, suggestions: [] })),
    });
  }

  groups.sort((a, b) => a.externalParkId.localeCompare(b.externalParkId));

  const attractionsByPark = new Map<string, { id: string; name: string }[]>();
  for (const g of groups) {
    if (!g.internalParkId || attractionsByPark.has(g.internalParkId)) continue;
    const { data: attractions, error: aErr } = await supabase
      .from("attractions")
      .select("id, name")
      .eq("park_id", g.internalParkId)
      .limit(400);
    if (aErr) throw new Error(aErr.message);
    attractionsByPark.set(g.internalParkId, (attractions ?? []) as { id: string; name: string }[]);
  }

  for (const g of groups) {
    if (!g.internalParkId) continue;
    const cat = attractionsByPark.get(g.internalParkId) ?? [];
    for (const row of g.rows) {
      const name = row.externalName ?? "";
      if (!name.trim()) continue;
      row.suggestions = cat
        .map((c) => ({
          attractionId: c.id,
          name: c.name,
          score: scoreNameSimilarity(name, c.name),
        }))
        .filter((r) => r.score > 0.08)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
    }
  }

  return { groups, truncated };
}
