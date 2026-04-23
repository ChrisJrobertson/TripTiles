import type { Park } from "@/lib/types";

const AI_COERCE_DEBUG =
  process.env.AI_GEN_DEBUG === "1" || process.env.NODE_ENV !== "production";

/** Lowercase a-z0-9 only (for fuzzy name matching). */
export function normaliseStripped(s: string): string {
  return s
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

/** Longest common substring length (contiguous). */
export function longestCommonSubstringLength(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  const m = a.length;
  const n = b.length;
  let best = 0;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > best) best = dp[i][j];
      }
    }
  }
  return best;
}

function logCoercion(tripId: string, raw: string, canonicalId: string): void {
  if (!AI_COERCE_DEBUG) return;
  console.info("[ai-park-id-coerce]", {
    trip_id: tripId,
    model_output: raw,
    catalog_id: canonicalId,
  });
}

export type AiParkIdResolver = {
  allowedSet: Set<string>;
  resolve: (raw: string) => string | null;
};

/**
 * Resolves a model's park / tile string to a catalogue id (allowed for this trip).
 * Order: strict id → trim+lowercase id → normalised name → longest substring vs name (≥6).
 */
export function buildAiParkIdResolver(
  allowedParks: Park[],
  tripId: string,
): AiParkIdResolver {
  const allowedSet = new Set(allowedParks.map((p) => p.id));
  const nameNormToId = new Map<string, string>();
  for (const p of allowedParks) {
    const nn = normaliseStripped(p.name);
    if (nn.length > 0 && !nameNormToId.has(nn)) {
      nameNormToId.set(nn, p.id);
    }
    const idn = normaliseStripped(p.id);
    if (idn.length > 0) nameNormToId.set(idn, p.id);
  }

  const parkMetas = allowedParks.map((p) => ({
    id: p.id,
    nameNorm: normaliseStripped(p.name),
    sort: p.sort_order,
  }));

  function resolveInner(raw: string): string | null {
    if (raw.length === 0) return null;
    if (allowedSet.has(raw)) return raw;

    const t = raw.trim().toLowerCase();
    if (allowedSet.has(t)) {
      if (t !== raw) logCoercion(tripId, raw, t);
      return t;
    }

    const ns = normaliseStripped(raw);
    if (ns.length > 0) {
      const fromMap = nameNormToId.get(ns);
      if (fromMap) {
        if (fromMap !== raw) logCoercion(tripId, raw, fromMap);
        return fromMap;
      }
    }

    if (ns.length < 1) return null;

    let best: { id: string; len: number; sort: number } | null = null;
    for (const p of parkMetas) {
      if (p.nameNorm.length < 2) continue;
      const len = longestCommonSubstringLength(ns, p.nameNorm);
      if (len < 6) continue;
      if (
        !best ||
        len > best.len ||
        (len === best.len && p.sort < best.sort)
      ) {
        best = { id: p.id, len, sort: p.sort };
      }
    }
    if (best) {
      logCoercion(tripId, raw, best.id);
      return best.id;
    }
    return null;
  }

  return {
    allowedSet,
    resolve: resolveInner,
  };
}
