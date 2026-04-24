import type { Attraction, RidePriority, SkipLineTier } from "@/types/attractions";

/** Approximate child height (cm) by age for quick height checks. */
export const ESTIMATED_HEIGHT_CM_BY_AGE: Record<number, number> = {
  3: 95,
  4: 102,
  5: 110,
  6: 115,
  7: 122,
  8: 127,
  9: 132,
  10: 137,
};

export function estimatedHeightCmForAge(age: number): number | null {
  const a = Math.floor(age);
  if (a in ESTIMATED_HEIGHT_CM_BY_AGE) {
    return ESTIMATED_HEIGHT_CM_BY_AGE[a]!;
  }
  if (a < 3) return 90;
  if (a > 10) return 150;
  return null;
}

export function skipLineBadgeLabel(tier: SkipLineTier | null): string {
  if (!tier) return "";
  if (tier === "single_pass") return "SP";
  if (tier === "multi_pass_tier1") return "T1";
  if (tier === "multi_pass_tier2") return "T2";
  if (tier === "express_now") return "NOW";
  return "EXP";
}

export function skipLineBadgeStyle(tier: SkipLineTier | null): {
  backgroundColor: string;
  color: string;
} {
  if (!tier) return { backgroundColor: "#2455ac", color: "#fff" };
  if (tier === "single_pass")
    return { backgroundColor: "#dd4e14", color: "#fff" };
  if (tier === "multi_pass_tier1")
    return { backgroundColor: "#2455ac", color: "#fff" };
  if (tier === "multi_pass_tier2")
    return { backgroundColor: "#3fa2ec", color: "#fff" };
  if (tier === "express" || tier === "express_now")
    return { backgroundColor: "#a2df56", color: "#fff" };
  return { backgroundColor: "#2455ac", color: "#fff" };
}

export function waitMinutesColourClass(minutes: number | null): string {
  if (minutes == null) return "text-royal/55";
  if (minutes <= 20) return "text-emerald-600";
  if (minutes <= 50) return "text-amber-600";
  return "text-red-600";
}

export function thrillEmoji(thrill: string): string {
  if (thrill === "gentle") return "👨‍👩‍👧";
  if (thrill === "moderate") return "🎢";
  if (thrill === "thrilling") return "🎢";
  if (thrill === "intense") return "⚡";
  return "🎢";
}

export function sortPrioritiesForDay<T extends { priority: RidePriority; sort_order: number }>(
  rows: T[],
): T[] {
  const must = rows.filter((r) => r.priority === "must_do");
  const ift = rows.filter((r) => r.priority === "if_time");
  must.sort((a, b) => a.sort_order - b.sort_order);
  ift.sort((a, b) => a.sort_order - b.sort_order);
  return [...must, ...ift];
}

export function buildLightningLaneStrategyBlurb(
  mustDo: Attraction[],
  parkHasDisney: boolean,
  parkHasUniversal: boolean,
  opts?: { includeDisney?: boolean; includeUniversal?: boolean },
): string {
  const includeDisney = opts?.includeDisney !== false;
  const includeUniversal = opts?.includeUniversal !== false;
  if (!includeDisney && !includeUniversal) {
    return "Skip-the-line product tips are turned off in your Smart Plan settings. General rope-drop and queue patience advice still applies.";
  }
  const tier1 = mustDo.filter((a) => a.skip_line_tier === "multi_pass_tier1");
  const tier2Burner = mustDo.find(
    (a) => a.skip_line_tier === "multi_pass_tier2" && a.name.includes("Haunted"),
  );
  const parts: string[] = [];
  if (parkHasDisney && includeDisney) {
    if (tier1.length) {
      const names = tier1.slice(0, 2).map((a) => a.name).join(" or ");
      parts.push(
        `Book ${names} as a strong Tier 1 Multi Pass pick if waits spike.`,
      );
    } else {
      parts.push(
        "Use Tier 2 Multi Pass rides (Haunted Mansion, Pirates) as early burners while you wait to book your next Tier 1.",
      );
    }
    if (tier2Burner) {
      parts.push(
        `${tier2Burner.name} is a handy Tier 2 slot early in the day.`,
      );
    }
  }
  if (parkHasUniversal && includeUniversal) {
    parts.push(
      "At Universal, Express skips the regular queue on eligible rides — confirm which ticket type you hold before you queue.",
    );
  }
  if (parts.length === 0) {
    return "Add a few must-do rides and we will tailor skip-the-line tips here.";
  }
  return parts.join(" ");
}

export function heightCheckLines(
  childAges: number[],
  selectedAttractions: Attraction[],
): string[] {
  if (!childAges.length || !selectedAttractions.length) return [];
  const lines: string[] = [];
  for (const age of childAges) {
    const h = estimatedHeightCmForAge(age);
    if (h == null) continue;
    const blocked = selectedAttractions.filter(
      (a) =>
        a.height_requirement_cm != null && a.height_requirement_cm > h,
    );
    if (blocked.length) {
      const names = blocked.map((b) => b.name).join(", ");
      lines.push(
        `Younger guest (age ${age}, ~${h} cm) cannot ride: ${names}.`,
      );
    }
  }
  return lines;
}
