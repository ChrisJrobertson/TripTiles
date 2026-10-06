import { classifyFreshness } from "@/lib/park-data/freshness";
import type { FreshnessState } from "@/lib/park-data/types";

export type ObservationCandidate = {
  provider: string;
  freshness: FreshnessState;
};

const FRESHNESS_RANK: FreshnessState[] = ["LIVE", "RECENT", "STALE", "UNKNOWN"];

/**
 * Pick one observation when providers disagree.
 * The winner and the reason are both returned. Nothing is averaged or invented.
 */
export function chooseObservation<T extends ObservationCandidate>(
  rows: readonly T[],
  primaryProvider: string,
  fallbackProvider: string | null,
): { row: T | null; reason: string } {
  if (rows.length === 0) return { row: null, reason: "no_data" };

  const order = [primaryProvider, fallbackProvider].filter(
    (provider): provider is string => Boolean(provider),
  );
  for (const freshness of FRESHNESS_RANK) {
    for (const provider of order) {
      const row = rows.find(
        (item) => item.provider === provider && item.freshness === freshness,
      );
      if (row) {
        const role = provider === primaryProvider ? "primary" : "fallback";
        return { row, reason: `${role}_${freshness.toLowerCase()}` };
      }
    }
  }

  const other = rows[0]!;
  return { row: other, reason: `other_provider_${other.freshness.toLowerCase()}` };
}

export type FallbackFetchResult<T> = {
  value: T | null;
  source: "primary" | "fallback" | "none";
  errors: { source: "primary" | "fallback"; message: string }[];
};

/**
 * Run the primary provider, then the fallback if the primary throws.
 * An empty successful payload is not a failure and does not invent a value.
 */
export async function fetchWithFallback<T>(args: {
  primary: () => Promise<T>;
  fallback: (() => Promise<T>) | null;
  isEmpty?: (value: T) => boolean;
}): Promise<FallbackFetchResult<T>> {
  const errors: FallbackFetchResult<T>["errors"] = [];
  try {
    const value = await args.primary();
    const empty = args.isEmpty ? args.isEmpty(value) : false;
    if (!empty || !args.fallback) {
      return { value, source: "primary", errors };
    }
  } catch (err) {
    errors.push({
      source: "primary",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  if (!args.fallback) {
    return { value: null, source: "none", errors };
  }

  try {
    const value = await args.fallback();
    return { value, source: "fallback", errors };
  } catch (err) {
    errors.push({
      source: "fallback",
      message: err instanceof Error ? err.message : String(err),
    });
    return { value: null, source: "none", errors };
  }
}

export function freshnessForObservation(input: {
  observedAt: string | null;
  fetchedAt: string | null;
  staleAfter: string | null;
  now?: Date;
}): FreshnessState {
  return classifyFreshness(input);
}
