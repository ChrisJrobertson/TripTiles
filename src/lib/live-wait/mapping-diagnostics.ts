import type { SupabaseClient } from "@supabase/supabase-js";

import type { LiveWaitOperatingStatus } from "@/types/live-wait";

export type LiveWaitMappingParkOption = {
  id: string;
  name: string;
  parkGroup: string;
};

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
  parkId?: string;
};

export type LiveWaitUnmappedGroup = {
  externalParkId: string;
  internalParkId: string | null;
  internalParkName: string | null;
  rows: LiveWaitUnmappedDiagnosticRow[];
};

export type LiveWaitMappingConsoleRow = {
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
  mappedParkId: string | null;
  mappedParkName: string | null;
  mappedAttractionId: string | null;
  mappedAttractionName: string | null;
  mappingConfidence: number | null;
  suggestedParkId: string | null;
  suggestedParkName: string | null;
  suggestions: AttractionCandidate[];
  bestScore: number;
  category: "mapped" | "high_confidence" | "ambiguous" | "no_candidate";
};

export type LiveWaitMappingConsoleDiagnostics = {
  provider: string;
  rows: LiveWaitMappingConsoleRow[];
  parkOptions: LiveWaitMappingParkOption[];
  externalParkIds: string[];
  stats: {
    currentRows: number;
    mappedRows: number;
    unmappedRows: number;
    highConfidenceSuggestions: number;
    ambiguousSuggestions: number;
    noCandidateRows: number;
  };
  filters: {
    provider: string;
    externalParkId: string | null;
    internalParkId: string | null;
    query: string;
    mode: "unmapped" | "mapped" | "all";
  };
  truncated: boolean;
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

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalText(value: unknown): string | null {
  const clean = cleanText(value);
  return clean ? clean : null;
}

function numericOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isOperatingStatus(value: unknown): LiveWaitOperatingStatus {
  return value === "open" ||
    value === "closed" ||
    value === "temporarily_closed" ||
    value === "refurb" ||
    value === "down" ||
    value === "unknown"
    ? value
    : "unknown";
}

function rowKey(provider: string, externalParkId: string, externalAttractionId: string): string {
  return `${provider}\u0000${externalParkId}\u0000${externalAttractionId}`;
}

function candidateCategory(
  mapped: boolean,
  bestScore: number,
): LiveWaitMappingConsoleRow["category"] {
  if (mapped) return "mapped";
  if (bestScore >= 0.72) return "high_confidence";
  if (bestScore > 0) return "ambiguous";
  return "no_candidate";
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

export async function buildLiveWaitMappingConsoleDiagnostics(
  supabase: SupabaseClient,
  options?: {
    provider?: string;
    externalParkId?: string | null;
    internalParkId?: string | null;
    query?: string | null;
    mode?: "unmapped" | "mapped" | "all";
    maxRows?: number;
  },
): Promise<LiveWaitMappingConsoleDiagnostics> {
  const provider = options?.provider?.trim() || "queue_times";
  const externalParkId = cleanOptionalText(options?.externalParkId);
  const internalParkId = cleanOptionalText(options?.internalParkId);
  const query = cleanText(options?.query).toLowerCase();
  const mode = options?.mode ?? "unmapped";
  const maxRows = options?.maxRows ?? 500;

  let currentQuery = supabase
    .from("live_wait_current")
    .select(
      "provider, external_park_id, external_attraction_id, external_name, wait_minutes, operating_status, is_open, observed_at, fetched_at, stale_after, park_id, attraction_id",
    )
    .eq("provider", provider)
    .order("external_park_id", { ascending: true })
    .order("external_name", { ascending: true })
    .limit(maxRows + 1);

  if (externalParkId) currentQuery = currentQuery.eq("external_park_id", externalParkId);

  const [
    { data: currentRowsRaw, error: currentError },
    { data: mappingsRaw, error: mappingError },
    { data: parksRaw, error: parksError },
  ] = await Promise.all([
    currentQuery,
    supabase
      .from("live_wait_provider_mappings")
      .select(
        "provider, external_park_id, external_attraction_id, park_id, attraction_id, external_name, mapping_confidence",
      )
      .eq("provider", provider)
      .limit(5000),
    supabase
      .from("parks")
      .select("id, name, park_group, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
      .limit(1000),
  ]);

  if (currentError) throw new Error(currentError.message);
  if (mappingError) throw new Error(mappingError.message);
  if (parksError) throw new Error(parksError.message);

  const currentRows = (currentRowsRaw ?? []) as Record<string, unknown>[];
  const truncated = currentRows.length > maxRows;
  const currentSlice = truncated ? currentRows.slice(0, maxRows) : currentRows;
  const mappings = (mappingsRaw ?? []) as Record<string, unknown>[];

  const parkOptions: LiveWaitMappingParkOption[] = ((parksRaw ?? []) as Record<string, unknown>[]).map(
    (park) => ({
      id: String(park.id),
      name: String(park.name ?? park.id),
      parkGroup: String(park.park_group ?? ""),
    }),
  );
  const parkNameById = new Map(parkOptions.map((park) => [park.id, park.name]));

  const mappingsByExternalKey = new Map<string, Record<string, unknown>>();
  const parkIdByExternalPark = new Map<string, string>();
  for (const mapping of mappings) {
    const mappingProvider = String(mapping.provider ?? provider);
    const mappingExternalParkId = String(mapping.external_park_id ?? "");
    const mappingExternalAttractionId = String(mapping.external_attraction_id ?? "");
    mappingsByExternalKey.set(
      rowKey(mappingProvider, mappingExternalParkId, mappingExternalAttractionId),
      mapping,
    );
    const mappedParkId = cleanOptionalText(mapping.park_id);
    if (mappedParkId && !parkIdByExternalPark.has(mappingExternalParkId)) {
      parkIdByExternalPark.set(mappingExternalParkId, mappedParkId);
    }
  }

  const attractionParkIds = new Set<string>();
  for (const row of currentSlice) {
    const rowParkId = cleanOptionalText(row.park_id);
    const extParkId = String(row.external_park_id ?? "");
    const mappedParkId = cleanOptionalText(
      mappingsByExternalKey.get(
        rowKey(String(row.provider ?? provider), extParkId, String(row.external_attraction_id ?? "")),
      )?.park_id,
    );
    const suggestionParkId = internalParkId ?? mappedParkId ?? parkIdByExternalPark.get(extParkId) ?? rowParkId;
    if (suggestionParkId) attractionParkIds.add(suggestionParkId);
  }
  if (internalParkId) attractionParkIds.add(internalParkId);

  const attractionRows: { id: string; name: string; park_id: string }[] = [];
  if (attractionParkIds.size > 0) {
    const { data: attractions, error: attractionError } = await supabase
      .from("attractions")
      .select("id, name, park_id")
      .in("park_id", [...attractionParkIds])
      .limit(5000);
    if (attractionError) throw new Error(attractionError.message);
    attractionRows.push(
      ...((attractions ?? []) as { id: string; name: string; park_id: string }[]),
    );
  }

  const attractionById = new Map(attractionRows.map((attraction) => [attraction.id, attraction]));
  const attractionsByPark = new Map<string, typeof attractionRows>();
  for (const attraction of attractionRows) {
    const list = attractionsByPark.get(attraction.park_id) ?? [];
    list.push(attraction);
    attractionsByPark.set(attraction.park_id, list);
  }

  const externalParkIds = [
    ...new Set(currentSlice.map((row) => String(row.external_park_id ?? "")).filter(Boolean)),
  ].sort();

  const allRows = currentSlice.map((current): LiveWaitMappingConsoleRow => {
    const rowProvider = String(current.provider ?? provider);
    const extParkId = String(current.external_park_id ?? "");
    const extAttractionId = String(current.external_attraction_id ?? "");
    const mapping = mappingsByExternalKey.get(rowKey(rowProvider, extParkId, extAttractionId));
    const mappedParkId =
      cleanOptionalText(mapping?.park_id) ?? cleanOptionalText(current.park_id);
    const mappedAttractionId =
      cleanOptionalText(mapping?.attraction_id) ?? cleanOptionalText(current.attraction_id);
    const mappedAttraction = mappedAttractionId ? attractionById.get(mappedAttractionId) : null;
    const suggestedParkId =
      internalParkId ?? mappedParkId ?? parkIdByExternalPark.get(extParkId) ?? null;
    const externalName = cleanOptionalText(current.external_name);
    const candidateAttractions = suggestedParkId
      ? attractionsByPark.get(suggestedParkId) ?? []
      : [];
    const suggestions = externalName
      ? candidateAttractions
          .map((attraction) => ({
            attractionId: attraction.id,
            name: attraction.name,
            parkId: attraction.park_id,
            score: scoreNameSimilarity(externalName, attraction.name),
          }))
          .filter((candidate) => candidate.score > 0.08)
          .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
          .slice(0, 5)
      : [];
    const bestScore = suggestions[0]?.score ?? 0;
    const mapped = Boolean(mappedParkId && mappedAttractionId);

    return {
      provider: rowProvider,
      externalParkId: extParkId,
      externalAttractionId: extAttractionId,
      externalName,
      waitMinutes: numericOrNull(current.wait_minutes),
      operatingStatus: isOperatingStatus(current.operating_status),
      isOpen: Boolean(current.is_open),
      observedAt: String(current.observed_at ?? ""),
      fetchedAt: String(current.fetched_at ?? ""),
      staleAfter: cleanOptionalText(current.stale_after),
      mappedParkId,
      mappedParkName: mappedParkId ? parkNameById.get(mappedParkId) ?? mappedParkId : null,
      mappedAttractionId,
      mappedAttractionName: mappedAttraction?.name ?? null,
      mappingConfidence: numericOrNull(mapping?.mapping_confidence),
      suggestedParkId,
      suggestedParkName: suggestedParkId ? parkNameById.get(suggestedParkId) ?? suggestedParkId : null,
      suggestions,
      bestScore,
      category: candidateCategory(mapped, bestScore),
    };
  });

  const stats = {
    currentRows: allRows.length,
    mappedRows: allRows.filter((row) => row.category === "mapped").length,
    unmappedRows: allRows.filter((row) => row.category !== "mapped").length,
    highConfidenceSuggestions: allRows.filter((row) => row.category === "high_confidence").length,
    ambiguousSuggestions: allRows.filter((row) => row.category === "ambiguous").length,
    noCandidateRows: allRows.filter((row) => row.category === "no_candidate").length,
  };

  const filteredRows = allRows.filter((row) => {
    if (mode === "unmapped" && row.category === "mapped") return false;
    if (mode === "mapped" && row.category !== "mapped") return false;
    if (!query) return true;
    const haystack = [
      row.externalName,
      row.mappedAttractionName,
      row.mappedParkName,
      row.suggestedParkName,
      ...row.suggestions.map((suggestion) => suggestion.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  return {
    provider,
    rows: filteredRows,
    parkOptions,
    externalParkIds,
    stats,
    filters: {
      provider,
      externalParkId,
      internalParkId,
      query,
      mode,
    },
    truncated,
  };
}
