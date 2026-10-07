import type { AttractionLiveState } from "@/lib/park-data/types";

export type DedupeLiveResult = {
  rows: AttractionLiveState[];
  duplicatesSkipped: number;
};

/**
 * Duplicate provider attraction ids are not merged.
 * Identical copies collapse to one row. Conflicting copies are dropped.
 */
export function dedupeLiveStates(rows: readonly AttractionLiveState[]): DedupeLiveResult {
  const groups = new Map<string, AttractionLiveState[]>();
  for (const row of rows) {
    const key = `${row.providerParkId}\t${row.providerAttractionId}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const kept: AttractionLiveState[] = [];
  let duplicatesSkipped = 0;
  for (const group of groups.values()) {
    if (group.length === 1) {
      kept.push(group[0]!);
      continue;
    }
    const first = group[0]!;
    const conflict = group.some(
      (row) =>
        row.waitMinutes !== first.waitMinutes ||
        row.operatingStatus !== first.operatingStatus ||
        row.isOpen !== first.isOpen,
    );
    if (conflict) {
      duplicatesSkipped += group.length;
      continue;
    }
    kept.push(first);
    duplicatesSkipped += group.length - 1;
  }
  return { rows: kept, duplicatesSkipped };
}
