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
      matchStatus: "confirmed_exact" | "manually_approved";
    }
  | { outcome: "unmapped" }
  | { outcome: "retired" }
  | { outcome: "ambiguous" }
  | { outcome: "candidate" }
  | { outcome: "missing" };

const USABLE = new Set<MatchStatus>(["confirmed_exact", "manually_approved"]);

/**
 * Legacy rows written before match_status existed are treated as manually
 * approved. They were explicit mapping rows, not runtime name matches.
 */
export function mappingAllowsFactUse(status: string | null | undefined): boolean {
  if (status == null || status.trim() === "") return true;
  return USABLE.has(status as MatchStatus);
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
    const status = row.matchStatus;
    const usable = status == null || USABLE.has(status);
    if (usable && row.triptilesId) usableIds.add(row.triptilesId);
  }
  if (usableIds.size > 1) return { outcome: "ambiguous" };
  if (usableIds.size === 1) {
    const row = matches.find(
      (item) =>
        item.triptilesId === [...usableIds][0] &&
        (item.matchStatus == null || USABLE.has(item.matchStatus)),
    );
    const status = row?.matchStatus ?? "manually_approved";
    return {
      outcome: "mapped",
      triptilesId: [...usableIds][0]!,
      matchStatus: status === "confirmed_exact" ? "confirmed_exact" : "manually_approved",
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
