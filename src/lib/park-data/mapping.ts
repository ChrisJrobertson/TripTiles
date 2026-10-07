import type { MatchStatus } from "@/lib/park-data/types";

export type EntityMappingRow = {
  provider: string;
  externalId: string;
  triptilesId: string | null;
  matchStatus: MatchStatus | null;
};

export type MappingResolution =
  | {
      outcome: "mapped";
      triptilesId: string;
      matchStatus: "confirmed_exact" | "manually_approved" | "legacy_unverified";
      verified: boolean;
    }
  | { outcome: "unmapped" }
  | { outcome: "retired" }
  | { outcome: "ambiguous" }
  | { outcome: "candidate" }
  | { outcome: "missing" };

const OPERATIONAL = new Set<MatchStatus>([
  "confirmed_exact",
  "manually_approved",
  "legacy_unverified",
]);

const VERIFIED = new Set<MatchStatus>(["confirmed_exact", "manually_approved"]);

/**
 * Operationally usable mapping: may attach a provider id to a TripTiles id
 * during ingest. Includes legacy rows that predate match_status.
 * Null/blank is treated as legacy_unverified, never as manually_approved.
 */
export function mappingAllowsOperationalUse(
  status: string | null | undefined,
): boolean {
  if (status == null || status.trim() === "") return true;
  return OPERATIONAL.has(status as MatchStatus);
}

/** @deprecated Prefer mappingAllowsOperationalUse — name kept for call sites. */
export function mappingAllowsFactUse(
  status: string | null | undefined,
): boolean {
  return mappingAllowsOperationalUse(status);
}

/**
 * Verified mapping: a human confirmed exact match or manually approved it.
 * legacy_unverified is operational but not verified.
 */
export function mappingIsVerified(status: string | null | undefined): boolean {
  if (status == null || status.trim() === "") return false;
  return VERIFIED.has(status as MatchStatus);
}

export function normaliseMatchStatus(
  status: string | null | undefined,
): MatchStatus {
  if (status == null || status.trim() === "") return "legacy_unverified";
  if (OPERATIONAL.has(status as MatchStatus) || status === "candidate" || status === "missing" || status === "retired" || status === "ambiguous") {
    return status as MatchStatus;
  }
  return "legacy_unverified";
}

/**
 * Resolve one provider entity id to a TripTiles id.
 * The provider display name is intentionally not an argument: names are not
 * an identity key, including when two catalogue names would both look similar.
 */
export function resolveEntityMapping(
  rows: readonly EntityMappingRow[],
  provider: string,
  externalId: string,
): MappingResolution {
  const matches = rows.filter(
    (row) => row.provider === provider && row.externalId === externalId,
  );
  if (matches.length === 0) return { outcome: "unmapped" };

  if (matches.some((row) => row.matchStatus === "ambiguous")) {
    return { outcome: "ambiguous" };
  }

  const usableIds = new Set<string>();
  for (const row of matches) {
    const usable = mappingAllowsOperationalUse(row.matchStatus);
    if (usable && row.triptilesId) usableIds.add(row.triptilesId);
  }
  if (usableIds.size > 1) return { outcome: "ambiguous" };
  if (usableIds.size === 1) {
    const row = matches.find(
      (item) =>
        item.triptilesId === [...usableIds][0] &&
        mappingAllowsOperationalUse(item.matchStatus),
    );
    const status = normaliseMatchStatus(row?.matchStatus);
    const usableStatus =
      status === "confirmed_exact" || status === "manually_approved"
        ? status
        : "legacy_unverified";
    return {
      outcome: "mapped",
      triptilesId: [...usableIds][0]!,
      matchStatus: usableStatus,
      verified: mappingIsVerified(usableStatus),
    };
  }

  if (matches.every((row) => row.matchStatus === "retired")) {
    return { outcome: "retired" };
  }
  if (matches.some((row) => row.matchStatus === "retired") && usableIds.size === 0) {
    const other = matches.filter((row) => row.matchStatus !== "retired");
    if (other.length === 0) return { outcome: "retired" };
  }
  if (matches.every((row) => row.matchStatus === "candidate")) {
    return { outcome: "candidate" };
  }
  if (matches.every((row) => row.matchStatus === "missing")) {
    return { outcome: "missing" };
  }
  if (matches.some((row) => row.matchStatus === "candidate")) {
    return { outcome: "candidate" };
  }
  if (matches.some((row) => row.matchStatus === "missing")) {
    return { outcome: "missing" };
  }
  return { outcome: "unmapped" };
}
