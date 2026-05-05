import type {
  AIDayStrategy,
  Assignment,
  DayPlanningIntent,
  Park,
  TripPlanningPreferences,
} from "@/lib/types";
import type { Attraction } from "@/types/attractions";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { isThemePark } from "@/lib/park-categories";

const RIDELIKE_STEP_TYPES = new Set<string>([
  "rope_drop",
  "standby",
  "lightning_lane",
  "single_rider",
  "express_pass",
]);

const HEIGHT_IN_LABEL_RE =
  /\(\s*(?:no\s*)?min(?:imum)?\s*\d+\s*cm[^)]*\)|\(\s*no\s*min(?:imum|\s+height)?[^)]*\)/gi;

/** Theme-park IDs assigned on slots for one calendar day. */
export function collectThemeParkSlotIdsForDay(
  assignmentForDay: Assignment | undefined | null,
  parkById: Map<string, Park>,
): Set<string> {
  const out = new Set<string>();
  if (!assignmentForDay) return out;
  for (const slot of ["am", "pm", "lunch", "dinner"] as const) {
    const id = getParkIdFromSlotValue(assignmentForDay[slot]);
    if (!id) continue;
    const p = parkById.get(id);
    if (p && isThemePark(p.park_group)) out.add(id);
  }
  return out;
}

function themeParkIdsFromIntent(
  intent: DayPlanningIntent,
  parkById: Map<string, Park>,
): string[] {
  return (intent.selectedParkIds ?? []).filter((id) => {
    const p = parkById.get(id);
    return p !== undefined && isThemePark(p.park_group);
  });
}

export function resolvePrimaryAndAllowedParkIdsForDayStrategy(input: {
  intent: DayPlanningIntent;
  assignmentForDay: Assignment | undefined | null;
  dominant: { id: string; park: Park } | null;
  /** Must be the anchored park row used when calendar + intent omit parks. */
  fallbackAnchorParkId: string;
  parkById: Map<string, Park>;
}): { primaryParkId: string; allowedParkIds: string[] } {
  const assignmentIds = collectThemeParkSlotIdsForDay(
    input.assignmentForDay ?? undefined,
    input.parkById,
  );
  const intentIds = themeParkIdsFromIntent(input.intent, input.parkById);

  let allowed: string[];
  if (intentIds.length > 0) {
    const narrowed = intentIds.filter((id) =>
      assignmentIds.size === 0 ? true : assignmentIds.has(id),
    );
    allowed = narrowed.length > 0 ? narrowed : [...intentIds];
  } else {
    allowed =
      assignmentIds.size > 0
        ? [...assignmentIds]
        : input.dominant
          ? [input.dominant.id]
          : [];
  }

  const dedupe = [...new Set(allowed)];

  if (dedupe.length === 0) {
    const id = input.fallbackAnchorParkId;
    return { primaryParkId: id, allowedParkIds: [id] };
  }

  const primaryParkId =
    input.dominant && dedupe.includes(input.dominant.id)
      ? input.dominant.id
      : dedupe[0]!;

  return {
    primaryParkId,
    allowedParkIds: dedupe,
  };
}

export function dominantFromIntentThemeParksOnly(
  intent: DayPlanningIntent | null | undefined,
  parkById: Map<string, Park>,
): { id: string; park: Park } | null {
  if (!intent) return null;
  const ids = themeParkIdsFromIntent(intent, parkById);
  if (ids.length === 0) return null;
  const first = ids[0]!;
  const p = parkById.get(first);
  return p ? { id: first, park: p } : null;
}

function stripFabricatedHeightFromLabel(raw: string): string {
  return raw.replace(HEIGHT_IN_LABEL_RE, "").replace(/\s{2,}/g, " ").trim();
}

function baseRideLabel(raw: string): string {
  return stripFabricatedHeightFromLabel(raw.trim());
}

/**
 * Prefer matches in `preferredParkIds` ordering when duplicate names exist.
 */
export function findAttractionMatchForRideLabel(
  rideOrEvent: string,
  catalogue: Attraction[],
  preferredParkOrder: readonly string[],
): Attraction | null {
  const base = baseRideLabel(rideOrEvent);
  const lower = base.toLowerCase();
  if (!lower) return null;

  const prefIndex = new Map(preferredParkOrder.map((id, i) => [id, i] as const));
  const sorted = [...catalogue].sort((a, b) => {
    const pa = prefIndex.get(a.park_id) ?? 999;
    const pb = prefIndex.get(b.park_id) ?? 999;
    if (pa !== pb) return pa - pb;
    return b.name.length - a.name.length;
    });

  const exact = sorted.find((a) => a.name.trim().toLowerCase() === lower);
  if (exact) return exact;

  for (const a of sorted.sort((x, y) => y.name.length - x.name.length)) {
    const n = a.name.trim().toLowerCase();
    if (lower.includes(n) || n.includes(lower)) return a;
  }
  return null;
}

function matchExpressLightningRideName(
  name: string,
  catalogue: Attraction[],
  allowedParkIds: Set<string>,
  preferredParkOrder: readonly string[],
): Attraction | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const all = catalogue.filter((a) => allowedParkIds.has(a.park_id));
  const m = findAttractionMatchForRideLabel(trimmed, all, preferredParkOrder);
  if (m && allowedParkIds.has(m.park_id)) return m;
  return null;
}

function synthesiseHeightWarning(
  att: Attraction,
  prefs: TripPlanningPreferences | null | undefined,
): string | undefined {
  if (
    prefs == null ||
    prefs.children <= 0 ||
    att.height_requirement_cm == null ||
    typeof att.height_requirement_cm !== "number"
  ) {
    return undefined;
  }
  const min = Math.round(att.height_requirement_cm);
  const heights = prefs.childHeights ?? [];
  if (heights.length < prefs.children) return undefined;
  const smallest = heights.reduce(
    (acc, ch) =>
      typeof ch.heightCm === "number" ? Math.min(acc, ch.heightCm) : acc,
    Infinity,
  );
  if (!Number.isFinite(smallest)) return undefined;
  if (smallest >= min - 1) return undefined;
  return `Catalogue minimum height ~${min} cm for "${att.name}" — smallest child logged ~${Math.round(smallest)} cm. Confirm in the official park app before queueing.`;
}

function isLikelyStructuralDescriptor(rideLower: string): boolean {
  return /(^|\s)(lunch|dinner|meal|quick[-\s]?service|table\s*service|snack|break|rest\b|rope\s+drop\b|browse|meet\b|shopping|photos?|castle|explore)(\s|$)/i.test(
    rideLower,
  );
}

function ensureRideSequenceContinuity(strategy: AIDayStrategy): AIDayStrategy {
  if (strategy.ride_sequence.length > 0) return strategy;
  return {
    ...strategy,
    ride_sequence: [
      {
        time: "10:00",
        type: "rest",
        ride_or_event: "Plan from verified list",
        notes:
          "No sequenced attraction steps survived safety checks — use optional notes below and your park checklist, then regenerate if needed.",
      },
    ],
    quality_warnings: [
      ...(strategy.quality_warnings ?? []),
      "The ride sequence could not include unknown or off-list attractions.",
    ],
  };
}

export type RecommendationSafetyCtx = {
  allowedParkIds: Set<string>;
  catalogue: Attraction[];
  planningPreferences: TripPlanningPreferences | null | undefined;
};

/**
 * Filters AI output against structured attractions: wrong-park / unknown thrills removed
 * from the main sequence (moved to optional notes). Drops fabricated height warnings when
 * we cannot anchor them on catalogue geometry + child heights.
 */
export function applyDayStrategyRecommendationSafety(
  strategy: AIDayStrategy,
  ctx: RecommendationSafetyCtx,
): { strategy: AIDayStrategy; logTags: string[] } {
  const logTags: string[] = [];
  const allowed = ctx.allowedParkIds;
  const preferredOrder = [...allowed];
  const optionalNotes = [...(strategy.optional_sequence_notes ?? [])];
  const nextSeq: AIDayStrategy["ride_sequence"] = [];

  const catLimited = ctx.catalogue.filter((a) => allowed.has(a.park_id));

  for (const step of strategy.ride_sequence) {
    const rideLike = RIDELIKE_STEP_TYPES.has(step.type);

    if (!rideLike) {
      nextSeq.push({
        ...step,
        ride_or_event: stripFabricatedHeightFromLabel(step.ride_or_event.trim()),
        notes: stripFabricatedHeightFromLabel(step.notes),
        height_warning: undefined,
      });
      continue;
    }

    const trimmed = step.ride_or_event.trim();
    const lower = baseRideLabel(trimmed).toLowerCase();
    const match = findAttractionMatchForRideLabel(trimmed, catLimited, preferredOrder);

    if (!match) {
      if (isLikelyStructuralDescriptor(lower)) {
        logTags.push("safety:kept_ridelike_semantic_descriptor");
        nextSeq.push({
          ...step,
          ride_or_event: stripFabricatedHeightFromLabel(trimmed),
          height_warning: undefined,
        });
        continue;
      }
      logTags.push("safety:demoted_unknown_ride");
      optionalNotes.push(
        `[Uncatalogued attraction — not verified] ${trimmed} @ ${step.time} (${step.type})`,
      );
      continue;
    }

    if (!allowed.has(match.park_id)) {
      logTags.push("safety:demoted_wrong_park");
      optionalNotes.push(
        `[Wrong park for this plan] "${trimmed}" matched "${match.name}" outside allowed parks.`,
      );
      continue;
    }

    const hw =
      synthesiseHeightWarning(match, ctx.planningPreferences) ??
      undefined;

    logTags.push("safety:canonicalised_attraction");

    nextSeq.push({
      ...step,
      ride_or_event: match.name,
      notes: stripFabricatedHeightFromLabel(step.notes),
      ...(hw ? { height_warning: hw } : {}),
    });
  }

  let lightning =
    strategy.lightning_lane_strategy == null
      ? undefined
      : { ...strategy.lightning_lane_strategy };

  if (lightning?.multi_pass_bookings?.length) {
    const kept: typeof lightning.multi_pass_bookings = [];
    for (const b of lightning.multi_pass_bookings) {
      const m = matchExpressLightningRideName(
        b.ride,
        ctx.catalogue,
        allowed,
        preferredOrder,
      );
      if (m) kept.push({ ...b, ride: m.name });
      else {
        logTags.push("safety:stripped_unknown_ll_booking");
        optionalNotes.push(
          `[Unverified Lightning Lane target] "${b.ride}" — dropped from bookings list.`,
        );
      }
    }
    lightning.multi_pass_bookings = kept;
  }

  if (lightning?.single_pass_recommendations?.length) {
    const next: string[] = [];
    for (const nm of lightning.single_pass_recommendations) {
      const m = matchExpressLightningRideName(
        nm,
        ctx.catalogue,
        allowed,
        preferredOrder,
      );
      if (m) next.push(m.name);
      else {
        logTags.push("safety:stripped_unknown_single_pass");
        optionalNotes.push(`[Unverified Single Pass idea] "${nm}"`);
      }
    }
    lightning = { ...lightning, single_pass_recommendations: next };
  }

  let express =
    strategy.express_pass_strategy == null
      ? undefined
      : { ...strategy.express_pass_strategy };

  if (express) {
    const pr: string[] = [];
    for (const nm of express.priority_rides) {
      const m = matchExpressLightningRideName(
        nm,
        ctx.catalogue,
        allowed,
        preferredOrder,
      );
      if (m) pr.push(m.name);
      else {
        logTags.push("safety:stripped_unknown_express_priority");
        optionalNotes.push(`[Unverified Express priority] "${nm}"`);
      }
    }
    const sk: string[] = [];
    for (const nm of express.skip_with_express) {
      const m = matchExpressLightningRideName(
        nm,
        ctx.catalogue,
        allowed,
        preferredOrder,
      );
      if (m) sk.push(m.name);
      else logTags.push("safety:stripped_unknown_express_skip");
    }
    express =
      pr.length === 0 && sk.length === 0
        ? undefined
        : {
            priority_rides: pr,
            skip_with_express: sk,
          };
  }

  const hasLl =
    lightning != null &&
    (lightning.multi_pass_bookings.length > 0 ||
      (lightning.single_pass_recommendations?.length ?? 0) > 0);

  const outBase: AIDayStrategy = {
    ...strategy,
    ride_sequence: nextSeq,
  };

  if (optionalNotes.length > 0) {
    outBase.optional_sequence_notes = [...new Set(optionalNotes)].slice(0, 24);
  } else if (strategy.optional_sequence_notes) {
    delete outBase.optional_sequence_notes;
  }

  if (hasLl) {
    outBase.lightning_lane_strategy = lightning;
  } else {
    delete outBase.lightning_lane_strategy;
  }

  if (express) {
    outBase.express_pass_strategy = express;
  } else {
    delete outBase.express_pass_strategy;
  }

  let finalStrategy = ensureRideSequenceContinuity(outBase);

  if (logTags.some((t) => t.startsWith("safety:demoted"))) {
    finalStrategy = {
      ...finalStrategy,
      quality_warnings: [
        ...(finalStrategy.quality_warnings ?? []),
        "Items that could not be matched to this park catalogue were moved to Optional notes.",
      ],
    };
    const qw = [...new Set(finalStrategy.quality_warnings ?? [])];
    finalStrategy = {
      ...finalStrategy,
      quality_warnings: qw,
    };
  }

  return { strategy: finalStrategy, logTags };
}

const PAID_QUEUE_STEP_TYPES = new Set([
  "express_pass",
  "lightning_lane",
  "single_rider",
]);

const STANDBY_ASSUMPTIONS_BANNER =
  "Paid queue access was not confirmed, so this plan uses standby assumptions.";

function isStandbyAssumptionsBannerLine(line: string): boolean {
  return line.trim() === STANDBY_ASSUMPTIONS_BANNER;
}

/** Model-sounding park hours — not grounded in TripTiles structured hours here. */
function lineReferencesUnsupportedParkHoursClaim(line: string): boolean {
  const t = line.trim();
  return (
    /\btypically\s+closes\b/i.test(t) ||
    /\bpark\s+closes\b/i.test(t) ||
    /\bcloses\s+at\b/i.test(t)
  );
}

/**
 * Any mention of paid/skip-line products or trip-level pass hooks — drop from
 * warnings when day intent is not `yes`, except the intentional standby banner.
 */
function lineReferencesPaidQueueOrSkipLineTopic(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (isStandbyAssumptionsBannerLine(t)) return false;
  const patterns: RegExp[] = [
    /\bexpress\s+pass\b/i,
    /\blightning\s+lane\b/i,
    /\bmulti[\s-]?pass\b/i,
    /\bpremier\s+pass\b/i,
    /\bsingle\s+rider\b/i,
    /\bpaid\s+queue\s+access\b/i,
    /\bskip[-\s]?the[-\s]?line\b/i,
    /\bskip[-\s]?line\b/i,
    /\bincluded\s+with\s+(your\s+)?hotel\b/i,
    /\bincluded_with_hotel\b/i,
    /\bhotel.{0,50}express\b/i,
    /\bguests?\s+with\s+express\b/i,
    /\bwith\s+your\s+express\b/i,
    /\busing\s+express\b/i,
    /\bgenie\+\b/i,
    /\bquick\s+queue\b/i,
  ];
  return patterns.some((re) => re.test(t));
}

function filterStandbyIntentWarningLines(lines: string[]): string[] {
  return lines.filter((l) => {
    if (typeof l !== "string") return false;
    const t = l.trim();
    if (!t) return false;
    if (isStandbyAssumptionsBannerLine(t)) return true;
    if (lineReferencesPaidQueueOrSkipLineTopic(l)) return false;
    if (lineReferencesUnsupportedParkHoursClaim(l)) return false;
    return true;
  });
}

/** Confirms or assumes the guest already has / is using paid skip-line products. */
function lineImpliesConfirmedPaidQueueAccess(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const patterns: RegExp[] = [
    /\bgiven\s+express/i,
    /\bexpress\s+pass\s+access/i,
    /\bincluded\s+express/i,
    /\brelies\s+on.{0,80}express/i,
    /\bqueue\s+strategy\s+relies/i,
    /\bhotel.{0,50}express/i,
    /\bwith\s+your\s+express/i,
    /\busing\s+(your\s+)?express/i,
    /\bwith\s+express\s+pass/i,
    /\byour\s+lightning\s+lane/i,
    /\bmulti[\s-]?pass\s+booking/i,
    /\bpremier\s+pass/i,
    /\bconfirmed\s+.{0,40}(express|lightning)/i,
  ];
  return patterns.some((re) => re.test(t));
}

/** Echoes trip wizard skip-line enum / profile — confusing when day intent is not_sure/no/decide_later. */
function lineSurfacesTripLevelSkipLineProfile(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const patterns: RegExp[] = [
    /\bincluded_with_hotel\b/i,
    /\bincluded\s+with\s+hotel\b/i,
    /\bmulti_pass_status\b/i,
    /\bsingle_pass_willing\b/i,
    /\bpaid\s+queue\s+access.{0,160}noted\s+as/i,
    /\bnoted\s+as\s+['"][^'"]*(included|express|lightning|multi_pass|hotel)/i,
    /\(express\s+pass\)[^.;]{0,120}\bnoted\b/i,
    /\(lightning\s+lane\)[^.;]{0,120}\bnoted\b/i,
  ];
  return patterns.some((re) => re.test(t));
}

function sentenceFailsStandbyCopyGuards(sentence: string): boolean {
  const t = sentence.trim();
  if (!t) return false;
  if (lineReferencesUnsupportedParkHoursClaim(t)) return true;
  if (lineReferencesPaidQueueOrSkipLineTopic(t)) return true;
  if (lineSurfacesTripLevelSkipLineProfile(t)) return true;
  if (lineImpliesConfirmedPaidQueueAccess(t)) return true;
  return false;
}

function scrubProseRemovingPaidQueueClaims(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const parts = t.split(/(?<=[.!?])\s+/);
  const kept = parts.filter((p) => !sentenceFailsStandbyCopyGuards(p));
  const out = kept.join(" ").trim();
  return out.length >= 8
    ? out
    : "Use standby queues unless you confirm paid skip-line options in the official app.";
}

/** Smart Plan / whole-trip notes when paid queue access is not confirmed on the day intent. */
export function scrubAmbiguousPaidQueueProse(text: string): string {
  return scrubProseRemovingPaidQueueClaims(text);
}

function paidQueueOptionalAdviceNotes(strategy: AIDayStrategy): string[] {
  const out: string[] = [];
  const e = strategy.express_pass_strategy;
  if (e && (e.priority_rides.length > 0 || e.skip_with_express.length > 0)) {
    out.push(
      `If you later purchase Express Pass: possible priority rides — ${e.priority_rides.join(", ") || "—"}; rides where Express may matter less — ${e.skip_with_express.join(", ") || "—"}.`,
    );
  }
  const l = strategy.lightning_lane_strategy;
  if (l?.multi_pass_bookings?.length) {
    out.push(
      `If you later add Lightning Lane / Multi Pass: example booking targets (not part of this standby plan) — ${l.multi_pass_bookings.map((b) => b.ride).join(", ")}.`,
    );
  }
  if (l?.single_pass_recommendations?.length) {
    out.push(
      `If you buy Single Pass later: ideas — ${l.single_pass_recommendations.join(", ")}.`,
    );
  }
  return out;
}

function filterOptionalNotesForNoOrNotSure(notes: string[]): string[] {
  return notes.filter((n) => {
    if (typeof n !== "string" || !n.trim()) return false;
    if (lineReferencesPaidQueueOrSkipLineTopic(n)) return false;
    if (lineReferencesUnsupportedParkHoursClaim(n)) return false;
    return true;
  });
}

/**
 * When day intent does not confirm paid skip-line access (`paidAccess` not `yes`),
 * strip paid-queue-dependent sequencing and strategies so the plan is standby-first.
 */
export function applyPaidAccessIntentSafety(
  strategy: AIDayStrategy,
  intent: DayPlanningIntent,
): { strategy: AIDayStrategy; logTags: string[] } {
  const logTags: string[] = [];
  if (intent.paidAccess === "yes") {
    return { strategy, logTags };
  }

  const optionalAdd = [...(strategy.optional_sequence_notes ?? [])];
  if (intent.paidAccess === "decide_later") {
    optionalAdd.push(...paidQueueOptionalAdviceNotes(strategy));
    logTags.push("paid_access_intent:decide_later_optional_advice");
  }

  const nextSeq: AIDayStrategy["ride_sequence"] = strategy.ride_sequence.map(
    (step) => {
      if (PAID_QUEUE_STEP_TYPES.has(step.type)) {
        logTags.push(`paid_access_intent:coerce_${step.type}_to_standby`);
        return {
          ...step,
          type: "standby",
          notes: scrubProseRemovingPaidQueueClaims(step.notes),
        };
      }
      return {
        ...step,
        notes: sentenceFailsStandbyCopyGuards(step.notes)
          ? scrubProseRemovingPaidQueueClaims(step.notes)
          : step.notes,
      };
    },
  );

  const qualityBase = filterStandbyIntentWarningLines(
    strategy.quality_warnings ?? [],
  );
  const qualityWithBanner = [
    ...new Set([...qualityBase, STANDBY_ASSUMPTIONS_BANNER]),
  ];

  let optionalNotesOut = optionalAdd;
  if (intent.paidAccess === "no" || intent.paidAccess === "not_sure") {
    optionalNotesOut = filterOptionalNotesForNoOrNotSure(optionalNotesOut);
  }

  const out: AIDayStrategy = {
    ...strategy,
    ride_sequence: nextSeq,
    arrival_reason: scrubProseRemovingPaidQueueClaims(strategy.arrival_reason),
    warnings: filterStandbyIntentWarningLines([...strategy.warnings]),
    quality_warnings: qualityWithBanner,
  };

  delete out.lightning_lane_strategy;
  delete out.express_pass_strategy;

  if (optionalNotesOut.length > 0) {
    out.optional_sequence_notes = [...new Set(optionalNotesOut)].slice(0, 28);
  } else {
    delete out.optional_sequence_notes;
  }

  logTags.push("paid_access_intent:stripped_ll_express_blocks");
  return { strategy: out, logTags };
}

export function formatAllowedAttractionsSectionsForPrompt(
  allowedParkIds: readonly string[],
  parkById: Map<string, Park>,
  catalogue: Attraction[],
): string {
  const lines: string[] = [];
  for (const pid of allowedParkIds) {
    const p = parkById.get(pid);
    const subset = catalogue
      .filter((a) => a.park_id === pid)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

    lines.push(`## ${p?.name ?? pid}`);
    lines.push("");
    lines.push(formatAttractionsBlockForDayStrategy(subset));
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function formatAttractionsBlockForDayStrategy(
  attractions: import("@/types/attractions").Attraction[],
): string {
  return attractions
    .map((a) => {
      const h =
        a.height_requirement_cm != null && Number.isFinite(a.height_requirement_cm)
          ? `${Math.round(a.height_requirement_cm)} cm catalogue minimum`
          : "no minimum height recorded in catalogue";
      const thrill = `thrill: ${a.thrill_level}`;
      const sk = a.skip_line_system
        ? `${a.skip_line_system}${a.skip_line_tier ? ` (${a.skip_line_tier})` : ""}`
        : "standby / variable skip-line offering";
      return `- ${a.name} | ${h} | ${thrill} | skip-line: ${sk}`;
    })
    .join("\n");
}
