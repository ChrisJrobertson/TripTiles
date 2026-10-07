import { classifyFreshness } from "@/lib/park-data/freshness";
import type { FreshnessState } from "@/lib/park-data/types";

export type ObservationCandidate = {
  provider: string;
  freshness: FreshnessState;
  observedAt?: string | null;
  waitMinutes?: number | null;
  isOpen?: boolean | null;
  operatingStatus?: string | null;
};

const FRESHNESS_RANK: FreshnessState[] = ["LIVE", "RECENT", "STALE", "UNKNOWN"];

export type ObservationChoice<T extends ObservationCandidate> = {
  row: T | null;
  reason: string;
  /** Other provider rows that were considered and not merged into the winner. */
  conflicts: T[];
  conflictKinds: ("wait" | "status" | "open")[];
};

function conflictKindsBetween<T extends ObservationCandidate>(
  winner: T,
  other: T,
): ("wait" | "status" | "open")[] {
  const kinds: ("wait" | "status" | "open")[] = [];
  if (
    winner.waitMinutes !== undefined &&
    other.waitMinutes !== undefined &&
    winner.waitMinutes !== other.waitMinutes
  ) {
    kinds.push("wait");
  }
  if (
    winner.isOpen !== undefined &&
    other.isOpen !== undefined &&
    winner.isOpen !== other.isOpen
  ) {
    kinds.push("open");
  }
  if (
    winner.operatingStatus !== undefined &&
    other.operatingStatus !== undefined &&
    winner.operatingStatus !== other.operatingStatus
  ) {
    kinds.push("status");
  }
  return kinds;
}

/**
 * Pick one observation when providers disagree.
 *
 * Rule: freshness first, then configured provider preference within that band.
 * A LIVE fallback therefore beats a STALE primary. Values are never averaged.
 * Losing rows are returned as conflicts; they are not synthesised into the winner.
 */
export function chooseObservation<T extends ObservationCandidate>(
  rows: readonly T[],
  primaryProvider: string,
  fallbackProvider: string | null,
): ObservationChoice<T> {
  if (rows.length === 0) {
    return { row: null, reason: "no_data", conflicts: [], conflictKinds: [] };
  }

  const order = [primaryProvider, fallbackProvider].filter(
    (provider): provider is string => Boolean(provider),
  );
  let winner: T | null = null;
  let reason = "no_data";
  for (const freshness of FRESHNESS_RANK) {
    for (const provider of order) {
      const row = rows.find(
        (item) => item.provider === provider && item.freshness === freshness,
      );
      if (row) {
        const role = provider === primaryProvider ? "primary" : "fallback";
        winner = row;
        reason = `${role}_${freshness.toLowerCase()}`;
        break;
      }
    }
    if (winner) break;
  }

  if (!winner) {
    const other = rows[0]!;
    winner = other;
    reason = `other_provider_${other.freshness.toLowerCase()}`;
  }

  const conflicts = rows.filter((row) => row !== winner);
  const conflictKinds = [
    ...new Set(conflicts.flatMap((row) => conflictKindsBetween(winner!, row))),
  ];
  if (conflictKinds.length > 0) {
    reason = `${reason}_conflict_${conflictKinds.sort().join("_")}`;
  }

  return { row: winner, reason, conflicts, conflictKinds };
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
