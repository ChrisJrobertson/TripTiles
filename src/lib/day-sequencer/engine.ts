import type { PlanningPace } from "@/lib/types";
import type { Attraction, TripRidePriority } from "@/types/attractions";
import type {
  AttractionSequencerMeta,
  DayAnchor,
  GenerateParkDaySequenceInput,
  GenerateParkDaySequenceResult,
  ParkDaySequenceItem,
  ParkDaySequenceOutput,
  SequencerPace,
} from "./types";

const WALK_BUFFER_MIN = 10;
const ROPE_DROP_WINDOW_MIN = 30;
const EVENING_WINDOW_MIN = 120;
const YOUNG_CHILD_V1_MAX_HEIGHT_CM = 111;
const DISNEY_PARK_IDS = new Set(["mk", "ep", "hs", "ak"]);

export function planningPaceToSequencerPace(pace: PlanningPace): SequencerPace {
  if (pace === "relaxed") return "relaxed";
  if (pace === "intense") return "go-go-go";
  return "balanced";
}

function parseHHmm(s: string): number {
  const t = s.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return NaN;
  return h * 60 + min;
}

function formatHHmm(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function waitBandLabel(effective: number): string {
  const lo = Math.max(5, Math.round(effective * 0.75));
  const hi = Math.max(lo + 5, Math.round(effective * 1.2));
  return `${lo}-${hi} min`;
}

function metaFor(
  id: string,
  meta?: Record<string, AttractionSequencerMeta>,
): AttractionSequencerMeta | undefined {
  return meta?.[id];
}

function derivedRopedropWait(
  a: Attraction,
  m?: AttractionSequencerMeta,
): number {
  if (m?.avg_wait_ropedrop_minutes != null) return m.avg_wait_ropedrop_minutes;
  const off = a.avg_wait_offpeak_minutes ?? 20;
  const peak = a.avg_wait_peak_minutes ?? off * 2;
  return Math.max(5, Math.round(off * 0.45 + peak * 0.08));
}

function derivedEveningWait(
  a: Attraction,
  m?: AttractionSequencerMeta,
): number {
  if (m?.avg_wait_evening_minutes != null) return m.avg_wait_evening_minutes;
  const off = a.avg_wait_offpeak_minutes ?? 20;
  const peak = a.avg_wait_peak_minutes ?? off * 2;
  return Math.max(5, Math.round((off * 1.15 + peak * 0.35) / 2));
}

type TimeBucket = "ropedrop" | "evening" | "peak" | "offpeak";

function timeBucketForMinuteResolved(
  minute: number,
  openM: number,
  closeM: number,
  dateIsPeak: boolean,
): TimeBucket {
  if (minute < openM + ROPE_DROP_WINDOW_MIN) return "ropedrop";
  if (minute >= closeM - EVENING_WINDOW_MIN) return "evening";
  return dateIsPeak ? "peak" : "offpeak";
}

function disneyLlEligible(a: Attraction): boolean {
  return a.skip_line_system === "disney_lightning_lane";
}

function effectiveWaitMinutes(args: {
  attraction: Attraction;
  meta?: AttractionSequencerMeta;
  entitlements: GenerateParkDaySequenceInput["entitlements"];
  bucket: TimeBucket;
  dateIsPeak: boolean;
}): number {
  const { attraction: a, meta, entitlements: e, bucket, dateIsPeak } = args;

  const multi =
    e.has_lightning_lane_multi_pass &&
    disneyLlEligible(a) &&
    a.skip_line_tier !== "single_pass";
  if (multi) return 10;

  const single =
    e.has_lightning_lane_single_pass &&
    disneyLlEligible(a) &&
    a.skip_line_tier === "single_pass";
  if (single) return 10;

  if (e.has_universal_express && a.skip_line_system === "universal_express") {
    return 15;
  }

  if (bucket === "ropedrop") return derivedRopedropWait(a, meta);
  if (bucket === "evening") return derivedEveningWait(a, meta);
  if (bucket === "peak" || dateIsPeak) {
    return a.avg_wait_peak_minutes ?? a.avg_wait_offpeak_minutes ?? 35;
  }
  return a.avg_wait_offpeak_minutes ?? a.avg_wait_peak_minutes ?? 25;
}

function monthFromDateKey(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return 1;
  return Number(m[2]);
}

function filterPriorities(
  input: GenerateParkDaySequenceInput,
): { kept: TripRidePriority[] } {
  const { priorities, attractions_by_id, park_ids, young_child_party_v1 } =
    input;
  const parkSet = new Set(park_ids);
  const month = monthFromDateKey(input.date);

  let smallest =
    input.smallest_rider_height_cm != null &&
    Number.isFinite(input.smallest_rider_height_cm)
      ? input.smallest_rider_height_cm!
      : null;
  if (smallest == null && young_child_party_v1) {
    smallest = YOUNG_CHILD_V1_MAX_HEIGHT_CM;
  }

  const kept: TripRidePriority[] = [];
  for (const p of priorities) {
    const a = attractions_by_id[p.attraction_id];
    if (!a) continue;
    if (!parkSet.has(a.park_id)) continue;
    if (a.is_temporarily_closed) continue;
    if (a.is_seasonal) {
      const sm = metaFor(a.id, input.attraction_meta_by_id)?.season_months;
      if (sm?.length && !sm.includes(month)) continue;
    }
    if (smallest != null) {
      const h = a.height_requirement_cm;
      if (h != null && h > smallest) continue;
    }
    kept.push(p);
  }

  return { kept };
}

function eligibleAttractionsInParks(
  input: GenerateParkDaySequenceInput,
  smallest: number | null,
): Attraction[] {
  const parkSet = new Set(input.park_ids);
  const month = monthFromDateKey(input.date);
  const out: Attraction[] = [];
  for (const a of Object.values(input.attractions_by_id)) {
    if (!parkSet.has(a.park_id)) continue;
    if (a.is_temporarily_closed) continue;
    if (a.category !== "ride") continue;
    if (a.is_seasonal) {
      const sm = metaFor(a.id, input.attraction_meta_by_id)?.season_months;
      if (sm?.length && !sm.includes(month)) continue;
    }
    if (smallest != null) {
      const h = a.height_requirement_cm;
      if (h != null && h > smallest) continue;
    }
    out.push(a);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function validateAnchors(input: GenerateParkDaySequenceInput): {
  ok: true;
} | {
  ok: false;
  code: "ANCHORS_OVERLAP" | "ANCHOR_ATTRACTION_WRONG_PARK";
  message: string;
} {
  const parkSet = new Set(input.park_ids);
  const sorted = [...input.anchors].sort(
    (a, b) => parseHHmm(a.start_time) - parseHHmm(b.start_time),
  );
  for (const an of sorted) {
    const aid = an.attraction_id?.trim();
    if (!aid) continue;
    const att = input.attractions_by_id[aid];
    if (!att) {
      return {
        ok: false,
        code: "ANCHOR_ATTRACTION_WRONG_PARK",
        message: `Unknown attraction "${aid}" on anchor "${an.name}".`,
      };
    }
    if (!parkSet.has(att.park_id)) {
      return {
        ok: false,
        code: "ANCHOR_ATTRACTION_WRONG_PARK",
        message: `Anchor "${an.name}" references ${att.name}, which is not in today's park list.`,
      };
    }
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    const ea = parseHHmm(a.end_time);
    const sb = parseHHmm(b.start_time);
    if (Number.isNaN(ea) || Number.isNaN(sb)) {
      return {
        ok: false,
        code: "ANCHORS_OVERLAP",
        message: `Invalid anchor time on "${a.name}" or "${b.name}".`,
      };
    }
    if (ea > sb) {
      return {
        ok: false,
        code: "ANCHORS_OVERLAP",
        message: `Anchors overlap: "${a.name}" ends after "${b.name}" starts.`,
      };
    }
  }
  return { ok: true };
}

function ropeDropRecommendation(
  input: GenerateParkDaySequenceInput,
  topRide: Attraction | null,
): string {
  if (!topRide) {
    return "Pick must-do rides for this day to tailor rope-drop advice.";
  }
  const primaryPark = input.park_ids[0] ?? "";
  const meta = metaFor(topRide.id, input.attraction_meta_by_id);
  const early = input.entitlements.has_early_entry
    ? " With early entry, aim to be at the tapstiles before posted opening."
    : "";

  if (primaryPark === "eu") {
    const land = meta?.land?.trim() || "your first land";
    const portal =
      meta?.land_portal?.trim() || "the park main entrance for that land";
    return `Head to ${land} first at rope drop — enter via ${portal}.${early}`;
  }

  const isDisney = DISNEY_PARK_IDS.has(primaryPark);
  const peak = topRide.avg_wait_peak_minutes ?? 0;
  if (isDisney && peak > 60) {
    return `Rope drop ${topRide.name} — waits spike above 60 min within the first hour.${early}`;
  }
  return `Open the park at your own pace — ${topRide.name} can be done any time.${early}`;
}

type FreeWindow = { start: number; end: number };

function buildFreeWindows(
  openM: number,
  closeM: number,
  anchors: DayAnchor[],
): FreeWindow[] {
  const sorted = [...anchors].sort(
    (a, b) => parseHHmm(a.start_time) - parseHHmm(b.start_time),
  );
  const wins: FreeWindow[] = [];
  let cursor = openM;
  for (const an of sorted) {
    const s = parseHHmm(an.start_time);
    const e = parseHHmm(an.end_time);
    if (!Number.isNaN(s) && s > cursor && s <= closeM) {
      wins.push({ start: cursor, end: Math.min(s, closeM) });
    }
    if (!Number.isNaN(e)) cursor = Math.max(cursor, Math.min(e, closeM));
  }
  if (cursor < closeM) wins.push({ start: cursor, end: closeM });
  return wins.filter((w) => w.end > w.start);
}

function intervalOverlapsLunch(
  start: number,
  end: number,
  lunchStart: number,
  lunchEnd: number,
): boolean {
  return start < lunchEnd && end > lunchStart;
}

function hasDiningAnchorBetween(
  anchors: DayAnchor[],
  rangeStart: number,
  rangeEnd: number,
): boolean {
  return anchors.some((a) => {
    if (a.type !== "dining_reservation") return false;
    const s = parseHHmm(a.start_time);
    const e = parseHHmm(a.end_time);
    if (Number.isNaN(s) || Number.isNaN(e)) return false;
    return s < rangeEnd && e > rangeStart;
  });
}

function landHintForAttraction(
  a: Attraction,
  meta?: AttractionSequencerMeta,
): string {
  const land = meta?.land?.trim();
  if (land) return land;
  return a.park_id.toUpperCase();
}

function buildDiningSuggestions(
  input: GenerateParkDaySequenceInput,
  windows: FreeWindow[],
  lastRideByWindow: (Attraction | null)[],
): string[] {
  const lunchA = parseHHmm("12:00");
  const lunchB = parseHHmm("14:00");
  const dinA = parseHHmm("17:30");
  const dinB = parseHHmm("19:30");
  const suggestions: string[] = [];

  if (
    !hasDiningAnchorBetween(input.anchors, lunchA, lunchB) &&
    windows.some((w) => intervalOverlapsLunch(w.start, w.end, lunchA, lunchB))
  ) {
    const idx = windows.findIndex((w) =>
      intervalOverlapsLunch(w.start, w.end, lunchA, lunchB),
    );
    const ride = idx >= 0 ? lastRideByWindow[idx] : null;
    const where = ride
      ? landHintForAttraction(
          ride,
          metaFor(ride.id, input.attraction_meta_by_id),
        )
      : "where you are in the park";
    suggestions.push(
      `Lunch window (12:00–14:00): no dining reservation — try quick service (mobile order) ${ride ? `near ${where}` : where}.`,
    );
  }

  if (
    !hasDiningAnchorBetween(input.anchors, dinA, dinB) &&
    windows.some((w) => w.start < dinB && w.end > dinA)
  ) {
    const idx = windows.findIndex((w) => w.start < dinB && w.end > dinA);
    const ride = idx >= 0 ? lastRideByWindow[idx] : null;
    const where = ride
      ? landHintForAttraction(
          ride,
          metaFor(ride.id, input.attraction_meta_by_id),
        )
      : "where you are in the park";
    suggestions.push(
      `Evening meal (17:30–19:30): no dining reservation — book table service or quick service ${ride ? `near ${where}` : where}.`,
    );
  }

  return suggestions;
}

/**
 * V1 deterministic day sequencer for theme-park days ("Plan my day ✨" rules engine).
 * Call only on park days; non-park days should keep the existing block-schedule path.
 *
 * Expects `priorities` in display order (e.g. `sortPrioritiesForDay`). Does not call live APIs.
 */
export function generateParkDaySequence(
  input: GenerateParkDaySequenceInput,
): GenerateParkDaySequenceResult {
  const v = validateAnchors(input);
  if (!v.ok) return v;

  if (input.priorities.length === 0) {
    return {
      ok: true,
      output: {
        day_type: "park",
        park: input.park_ids[0] ?? "",
        rope_drop_recommendation:
          "No priorities set. Pick your must-ride list first.",
        sequence: [],
        anchor_confirmations: [],
        anchor_confirmation: "",
        pace_applied: input.pace,
        warnings: [],
        dining_suggestions: [],
      },
    };
  }

  const { kept: filtered } = filterPriorities(input);

  let smallestForEligible: number | null =
    input.smallest_rider_height_cm != null &&
    Number.isFinite(input.smallest_rider_height_cm)
      ? input.smallest_rider_height_cm!
      : null;
  if (smallestForEligible == null && input.young_child_party_v1) {
    smallestForEligible = YOUNG_CHILD_V1_MAX_HEIGHT_CM;
  }

  if (filtered.length === 0) {
    const partyHeightRule =
      input.young_child_party_v1 || smallestForEligible != null;
    const eligible = eligibleAttractionsInParks(input, smallestForEligible);
    if (partyHeightRule && eligible.length > 0) {
      const names = eligible.slice(0, 24).map((a) => a.name);
      const extra =
        eligible.length > 24 ? ` …and ${eligible.length - 24} more.` : "";
      return {
        ok: true,
        output: {
          day_type: "park",
          park: input.park_ids[0] ?? "",
          rope_drop_recommendation:
            "Party height filters removed every pick on your priority list.",
          sequence: [],
          anchor_confirmations: [],
          anchor_confirmation: "",
          pace_applied: input.pace,
          warnings: [
            `With young-child restrictions applied, only these rides are eligible: ${names.join(", ")}${extra}`,
          ],
          dining_suggestions: [],
        },
      };
    }
    return {
      ok: true,
      output: {
        day_type: "park",
        park: input.park_ids[0] ?? "",
        rope_drop_recommendation:
          "No rides left after filters — adjust your list or party settings.",
        sequence: [],
        anchor_confirmations: [],
        anchor_confirmation: "",
        pace_applied: input.pace,
        warnings: [],
        dining_suggestions: [],
      },
    };
  }

  const topAttraction =
    attractions_by_id_get(input, filtered[0]!.attraction_id) ?? null;
  const rope = ropeDropRecommendation(input, topAttraction);

  const openM = input.park_open_minutes;
  const closeM = input.park_close_minutes;
  const windows = buildFreeWindows(openM, closeM, input.anchors);

  const paceGap =
    input.pace === "relaxed" ? 15 : input.pace === "go-go-go" ? 0 : 0;

  const queue = [...filtered];
  const lastRideByWindow: (Attraction | null)[] = windows.map(() => null);

  const ridePieces: {
    order: number;
    startMin: number;
    attraction: Attraction;
    band: string;
    note: string | null;
  }[] = [];

  let orderCounter = 0;
  for (let wi = 0; wi < windows.length; wi++) {
    const w = windows[wi]!;
    let cursor = w.start;
    let remaining = w.end - w.start;
    while (queue.length > 0 && remaining > 0) {
      let placedThisRound = false;
      for (let i = 0; i < queue.length; i++) {
        const pr = queue[i]!;
        const a = attractions_by_id_get(input, pr.attraction_id);
        if (!a) {
          queue.splice(i, 1);
          i -= 1;
          continue;
        }
        const bucket = timeBucketForMinuteResolved(
          cursor,
          openM,
          closeM,
          input.date_is_peak_season,
        );
        const wEff = effectiveWaitMinutes({
          attraction: a,
          meta: metaFor(a.id, input.attraction_meta_by_id),
          entitlements: input.entitlements,
          bucket,
          dateIsPeak: input.date_is_peak_season,
        });
        const dur = a.duration_minutes ?? 5;
        const cost = wEff + dur + WALK_BUFFER_MIN + paceGap;
        if (cost > remaining) continue;
        const band = waitBandLabel(wEff);
        const note =
          ridePieces.length === 0 && wi === 0 && bucket === "ropedrop"
            ? "Rope drop priority"
            : null;
        orderCounter += 1;
        ridePieces.push({
          order: orderCounter,
          startMin: cursor,
          attraction: a,
          band,
          note,
        });
        lastRideByWindow[wi] = a;
        queue.splice(i, 1);
        cursor += cost;
        remaining = w.end - cursor;
        placedThisRound = true;
        break;
      }
      if (!placedThisRound) break;
    }
  }

  const totalListed = filtered.length;
  const placedCount = ridePieces.length;
  const warnings: string[] = [];
  if (placedCount < totalListed) {
    warnings.push(
      `Only the top ${placedCount} from your list fit this day.`,
    );
  }
  if (input.pace === "relaxed") {
    const hrs = (closeM - openM) / 60;
    if (hrs > 8) {
      warnings.push(
        "Relaxed pace: consider a rest break around 14:00 — benches, show, or pool time tomorrow.",
      );
    }
  }
  if (input.pace === "go-go-go") {
    warnings.push(
      "Go-go-go pace: consider skipping a long sit-down lunch — mobile order quick service between rides.",
    );
  }

  const dining_suggestions = buildDiningSuggestions(
    input,
    windows,
    lastRideByWindow,
  );

  const anchorSorted = [...input.anchors].sort(
    (a, b) => parseHHmm(a.start_time) - parseHHmm(b.start_time),
  );
  const anchor_confirmations = anchorSorted.map((an) => {
    const start = an.start_time;
    return `${an.name} anchored at ${start}. Sequence built around it.`;
  });

  const sequence = mergeRideAndAnchorSequence(ridePieces, anchorSorted);

  const output: ParkDaySequenceOutput = {
    day_type: "park",
    park: input.park_ids[0] ?? "",
    rope_drop_recommendation: rope,
    sequence,
    anchor_confirmations,
    anchor_confirmation: anchor_confirmations.join(" "),
    pace_applied: input.pace,
    warnings,
    dining_suggestions,
  };

  return { ok: true, output };
}

function attractions_by_id_get(
  input: GenerateParkDaySequenceInput,
  id: string,
): Attraction | undefined {
  return input.attractions_by_id[id];
}

function mergeRideAndAnchorSequence(
  ridePieces: {
    order: number;
    startMin: number;
    attraction: Attraction;
    band: string;
    note: string | null;
  }[],
  anchors: DayAnchor[],
): ParkDaySequenceItem[] {
  type Internal =
    | {
        kind: "ride";
        startMin: number;
        order: number;
        attraction: Attraction;
        band: string;
        note: string | null;
      }
    | {
        kind: "anchor";
        startMin: number;
        anchor: DayAnchor;
      };

  const items: Internal[] = [
    ...ridePieces.map((r) => ({
      kind: "ride" as const,
      startMin: r.startMin,
      order: r.order,
      attraction: r.attraction,
      band: r.band,
      note: r.note,
    })),
    ...anchors.map((an) => ({
      kind: "anchor" as const,
      startMin: parseHHmm(an.start_time) || 0,
      anchor: an,
    })),
  ];
  items.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    if (a.kind === b.kind) return 0;
    return a.kind === "anchor" ? -1 : 1;
  });

  const out: ParkDaySequenceItem[] = [];
  let ord = 0;
  for (const it of items) {
    ord += 1;
    if (it.kind === "ride") {
      out.push({
        order: ord,
        time_estimate: formatHHmm(it.startMin),
        attraction_id: it.attraction.id,
        type: "ride",
        expected_wait_band: it.band,
        note: it.note,
      });
    } else {
      const an = it.anchor;
      const note =
        an.type === "lightning_lane"
          ? "Lightning Lane window"
          : an.type === "dining_reservation"
            ? "Dining reservation"
            : an.type === "express_now"
              ? "Express window"
              : an.type === "character_meet"
                ? "Character meet"
                : an.type === "show"
                  ? "Show"
                  : null;
      out.push({
        order: ord,
        time_estimate: an.start_time,
        type: "anchor",
        anchor_id: an.id,
        name: an.name,
        time_window: `${an.start_time}-${an.end_time}`,
        note,
      });
    }
  }

  return out;
}
