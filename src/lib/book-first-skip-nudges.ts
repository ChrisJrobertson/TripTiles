import { sortPrioritiesForDay } from "@/lib/ride-plan-display";
import type { SkipLineTier, TripRidePriority } from "@/types/attractions";

function tierRank(t: SkipLineTier | null | undefined): number {
  if (t == null) return 99;
  const order: Partial<Record<SkipLineTier, number>> = {
    multi_pass_tier1: 1,
    single_pass: 2,
    express: 2,
    express_now: 2,
    multi_pass_tier2: 3,
  };
  return order[t] ?? 50;
}

function attractionName(r: TripRidePriority): string {
  return r.attraction?.name ?? "Ride";
}

/**
 * Short, ordered “book / stack” hints for must-do headliners with skip lines.
 * Not live data — tactical ordering only.
 */
export function buildBookFirstSkipNudges(
  rideRows: TripRidePriority[],
): string[] {
  const must = sortPrioritiesForDay(rideRows).filter(
    (r) => r.priority === "must_do" && r.attraction,
  );
  if (must.length === 0) return [];

  const skippable = must.filter(
    (r) =>
      r.attraction!.skip_line_tier != null ||
      r.attraction!.skip_line_system != null,
  );
  if (skippable.length === 0) {
    return [
      "Add must-do headliners that offer Lightning Lane or Express in your park — we’ll add booking order hints here.",
    ];
  }

  const ordered = [...skippable].sort((a, b) => {
    const da = tierRank(a.attraction!.skip_line_tier);
    const db = tierRank(b.attraction!.skip_line_tier);
    if (da !== db) return da - db;
    const ra = a.skip_line_return_hhmm?.trim() ?? "zz";
    const rb = b.skip_line_return_hhmm?.trim() ?? "zz";
    if (ra !== rb) return ra.localeCompare(rb);
    return attractionName(a).localeCompare(attractionName(b));
  });

  const lines: string[] = [];
  const top = ordered.slice(0, 4);
  for (const r of top) {
    const nm = attractionName(r);
    const ret = r.skip_line_return_hhmm?.trim();
    if (ret) {
      lines.push(
        `Prioritise ${nm} around your ${ret} return — stack your next bookable headliner after that window.`,
      );
    } else {
      const tier = r.attraction!.skip_line_tier;
      const tierHint =
        tier === "multi_pass_tier1"
          ? "tier-1 Multi Pass / headliner"
          : tier === "single_pass" || tier === "express" || tier === "express_now"
            ? "high-demand queue"
            : "skip line";
      lines.push(
        `Rope drop / first booking pass: try ${nm} (${tierHint}) before booking overlapping returns elsewhere.`,
      );
    }
  }

  const pasted = must.find(
    (r) =>
      r.pasted_queue_minutes != null &&
      r.pasted_queue_minutes > 0 &&
      r.attraction,
  );
  if (pasted) {
    lines.push(
      `You pasted a ~${pasted.pasted_queue_minutes} min wait for ${attractionName(pasted)} — treat as a snapshot, not live.`,
    );
  }

  return Array.from(new Set(lines)).slice(0, 6);
}
