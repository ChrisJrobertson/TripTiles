/**
 * Trip milestone dates: stored user rows plus computed auto milestones (never stored).
 * Dates are ISO `YYYY-MM-DD` only; countdown uses noon parsing (existing CountdownChip).
 */

import type { KeyDate, KeyDateCategory, Trip } from "@/lib/types";

// ——— Exact titles used for suggested seeds & idempotent merge ———
export const KEY_DATE_TITLE_DISNEY_DINING_OPEN = "Disney dining reservations open";
export const KEY_DATE_TITLE_UNIVERSAL_EXPRESS = "Universal Express Pass";
export const KEY_DATE_TITLE_ESTA = "ESTA / travel authorisation";
export const KEY_DATE_TITLE_ONLINE_CHECKIN = "Online check-in opens";
export const KEY_DATE_TITLE_TRAVEL_INSURANCE = "Confirm travel insurance";

/** Disney international — no numeric window; reminder anchored to departure week. */
export const KEY_DATE_TITLE_DISNEY_DINING_RULES = "Disney dining — check reservation rules";

export const AUTO_ID_DEPARTURE = "auto-departure";
export const AUTO_ID_RETURN_HOME = "auto-return-home";
export const AUTO_ID_CRUISE_PORT = "auto-cruise-port";
export const AUTO_ID_CRUISE_ADULT_DINING = "auto-cruise-adult-dining";
export const AUTO_ID_CRUISE_EMBARK = "auto-cruise-embark";
export const AUTO_ID_CRUISE_DISEMBARK = "auto-cruise-disembark";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UK_DOMESTIC_REGION_IDS = new Set([
  "uk",
  "london",
  "edinburgh",
  "bath",
  "liverpool",
  "york",
  "manchester",
  "cambridge",
  "lakedist",
  "lake_district",
  "cornwall",
  "highlands",
  "cardiff",
  "belfast",
  "brighton",
  "stratfm",
  "uk_combo",
]);

const REGION_TIER_US_WDW = new Set(["orlando", "florida_combo"]);
const REGION_TIER_DL_CALIFORNIA = new Set(["cali"]);
const REGION_TIER_US_NON_DISNEY = new Set(["miami", "lasvegas"]);
const REGION_TIER_DISNEY_INTL = new Set(["paris", "tokyo", "shanghai", "hongkong"]);
const REGION_TIER_UNIVERSAL_INTL = new Set(["osaka", "singapore"]);

export type PlannerKeyDateRow = {
  id: string;
  icon: string;
  label: string;
  dateKey: string;
  notes?: string;
};

function shiftIsoDate(dateKey: string, deltaDays: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function isAutoManagedKeyDateId(id: string): boolean {
  return typeof id === "string" && id.startsWith("auto-");
}

export function readUserKeyDates(prefs: Trip["preferences"] | null | undefined): KeyDate[] {
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return [];
  const raw = (prefs as Record<string, unknown>).key_dates;
  if (!Array.isArray(raw)) return [];
  const out: KeyDate[] = [];
  for (const row of raw) {
    const k = coerceKeyDateRow(row);
    if (k && !isAutoManagedKeyDateId(k.id)) out.push(k);
  }
  return out;
}

function coerceKeyDateRow(row: unknown): KeyDate | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const o = row as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const icon = typeof o.icon === "string" ? o.icon.trim() : "";
  const date =
    typeof o.date === "string" ? o.date.trim() : "";
  const sortRaw = Number(o.sort_order);
  const sort_order = Number.isFinite(sortRaw) ? sortRaw : 0;
  if (!UUID_RE.test(id) || isAutoManagedKeyDateId(id)) return null;
  if (title.length < 1 || title.length > 200) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (icon.length < 1 || icon.length > 30) return null;
  const description =
    typeof o.description === "string" ? o.description.slice(0, 300).trim() : undefined;
  const cat = normalizeCategory(o.category);
  const kd: KeyDate = {
    id,
    title,
    icon,
    date,
    sort_order,
    ...(description ? { description } : {}),
    ...(cat ? { category: cat } : {}),
  };
  return kd;
}

function normalizeCategory(v: unknown): KeyDateCategory | undefined {
  if (typeof v !== "string") return undefined;
  const x = v.trim().toLowerCase();
  if (x === "booking" || x === "admin" || x === "travel" || x === "other") {
    return x;
  }
  return undefined;
}

/** Auto milestones mirrored from trip fields (never in `preferences.key_dates`). */
export function getAutoKeyDates(trip: Trip): KeyDate[] {
  const rows: KeyDate[] = [];
  const { start_date, end_date, has_cruise, cruise_embark, cruise_disembark } =
    trip;

  if (/^\d{4}-\d{2}-\d{2}$/.test(start_date)) {
    rows.push({
      id: AUTO_ID_DEPARTURE,
      icon: "✈️",
      title: "Departure",
      date: start_date,
      sort_order: -2000,
      category: "travel",
    });
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    rows.push({
      id: AUTO_ID_RETURN_HOME,
      icon: "🏠",
      title: "Return home",
      date: end_date,
      sort_order: -1000,
      category: "travel",
    });
  }

  if (has_cruise && cruise_embark && /^\d{4}-\d{2}-\d{2}$/.test(cruise_embark)) {
    const p75 = shiftIsoDate(cruise_embark, -75);
    if (p75) {
      rows.push({
        id: AUTO_ID_CRUISE_PORT,
        icon: "🚢",
        title: "Disney Cruise port adventures",
        description:
          "Port adventures release by sailing — check your Castaway Club window.",
        date: p75,
        sort_order: -500,
        category: "booking",
      });
      rows.push({
        id: AUTO_ID_CRUISE_ADULT_DINING,
        icon: "🍷",
        title: "Disney Cruise adult dining",
        description:
          "Palo, Enchante, and Remy book early for popular nights.",
        date: p75,
        sort_order: -499,
        category: "booking",
      });
    }
    rows.push({
      id: AUTO_ID_CRUISE_EMBARK,
      icon: "🚢",
      title: "Cruise embarkation",
      date: cruise_embark,
      sort_order: -400,
      category: "travel",
    });
  }
  if (
    has_cruise &&
    cruise_disembark &&
    /^\d{4}-\d{2}-\d{2}$/.test(cruise_disembark)
  ) {
    rows.push({
      id: AUTO_ID_CRUISE_DISEMBARK,
      icon: "🚢",
      title: "Cruise disembarkation",
      date: cruise_disembark,
      sort_order: -300,
      category: "travel",
    });
  }

  return rows.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));
}

function isUkDomesticRegion(
  region_id: string | null | undefined,
  countryCode: string | null | undefined,
): boolean {
  const rid = region_id?.trim();
  if (rid && UK_DOMESTIC_REGION_IDS.has(rid)) return true;
  const cc = countryCode?.trim().toUpperCase();
  return cc === "GB";
}

export type SeedTripParams = Pick<
  Trip,
  | "region_id"
  | "start_date"
  | "has_cruise"
  | "cruise_embark"
  | "cruise_disembark"
> & {
  /** From `regions.country_code` when known — classifies UK domestic beyond the static id set. */
  region_country_code?: string | null;
};

/** Pure suggested rows (without ids) for merge & trip creation hydration. */
export function computeSeedTemplates(params: SeedTripParams): Omit<KeyDate, "id">[] {
  const { region_id, start_date, has_cruise } = params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) return [];

  let order = 0;
  const nextOrder = () => order++ * 10;
  const out: Omit<KeyDate, "id">[] = [];
  const haveTitle = new Set<string>();

  const push = (
    title: string,
    icon: string,
    deltaFromStart: number,
    opts: {
      category?: KeyDateCategory;
      description?: string;
    } = {},
  ) => {
    const dk = shiftIsoDate(start_date, deltaFromStart);
    if (!dk || !/^\d{4}-\d{2}-\d{2}$/.test(dk)) return;
    const t = title.trim();
    if (!t || haveTitle.has(t)) return;
    haveTitle.add(t);
    out.push({
      title: t,
      icon,
      date: dk,
      sort_order: nextOrder(),
      ...(opts.description ? { description: opts.description } : {}),
      ...(opts.category ? { category: opts.category } : {}),
    });
  };

  const rid = (region_id ?? "").trim();
  /** Blank trips (no destination yet) skip generic international seeds except cruise insurance. */
  if (!rid) {
    if (has_cruise) {
      push(KEY_DATE_TITLE_TRAVEL_INSURANCE, "📋", -14, {
        category: "admin",
        description:
          "Make sure your policy covers the trip dates and activities.",
      });
    }
    return out.sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return a.sort_order - b.sort_order;
    });
  }

  if (REGION_TIER_US_WDW.has(rid)) {
    push(KEY_DATE_TITLE_DISNEY_DINING_OPEN, "🍽️", -60, {
      category: "booking",
      description:
        "Table-service restaurants book up fast — set a reminder for 6am.",
    });
    push(KEY_DATE_TITLE_UNIVERSAL_EXPRESS, "🎢", -14, {
      category: "booking",
      description:
        "Book Universal Orlando passes ahead — peak seasons sell out.",
    });
    push(KEY_DATE_TITLE_ESTA, "🛂", -14, {
      category: "admin",
      description:
        "Apply at esta.cbp.dhs.gov if required for your nationality — allow 72hrs minimum.",
    });
    push(KEY_DATE_TITLE_ONLINE_CHECKIN, "✈️", -1, {
      category: "travel",
      description:
        "Most airlines open check-in 24 hours before departure.",
    });
    push(KEY_DATE_TITLE_TRAVEL_INSURANCE, "📋", -14, {
      category: "admin",
      description:
        "Make sure your policy covers the trip dates and activities.",
    });
  } else if (REGION_TIER_DL_CALIFORNIA.has(rid)) {
    push(KEY_DATE_TITLE_DISNEY_DINING_OPEN, "🍽️", -60, {
      category: "booking",
      description:
        "Table-service restaurants book up fast — set a reminder for 6am.",
    });
    push(KEY_DATE_TITLE_UNIVERSAL_EXPRESS, "🎢", -14, {
      category: "booking",
      description: "Universal Hollywood — book ahead for peak seasons.",
    });
    push(KEY_DATE_TITLE_ESTA, "🛂", -14, {
      category: "admin",
      description:
        "Apply at esta.cbp.dhs.gov if required for your nationality — allow 72hrs minimum.",
    });
    push(KEY_DATE_TITLE_ONLINE_CHECKIN, "✈️", -1, {
      category: "travel",
      description:
        "Most airlines open check-in 24 hours before departure.",
    });
    push(KEY_DATE_TITLE_TRAVEL_INSURANCE, "📋", -14, {
      category: "admin",
      description:
        "Make sure your policy covers the trip dates and activities.",
    });
  } else if (REGION_TIER_US_NON_DISNEY.has(rid)) {
    push(KEY_DATE_TITLE_ESTA, "🛂", -14, {
      category: "admin",
      description:
        "Apply at esta.cbp.dhs.gov if required for your nationality — allow 72hrs minimum.",
    });
    push(KEY_DATE_TITLE_ONLINE_CHECKIN, "✈️", -1, {
      category: "travel",
      description:
        "Most airlines open check-in 24 hours before departure.",
    });
    push(KEY_DATE_TITLE_TRAVEL_INSURANCE, "📋", -14, {
      category: "admin",
      description:
        "Make sure your policy covers the trip dates and activities.",
    });
  } else if (REGION_TIER_DISNEY_INTL.has(rid)) {
    push(KEY_DATE_TITLE_DISNEY_DINING_RULES, "🍽️", 0, {
      category: "booking",
      description:
        "Table-service reservations use different booking windows depending on resort (Tokyo Disneyland, Disneyland Paris, etc.). Open your official Disney park app or site and confirm rules for your park before arrival.",
    });
    push(KEY_DATE_TITLE_ONLINE_CHECKIN, "✈️", -1, {
      category: "travel",
      description:
        "Most airlines open check-in 24 hours before departure.",
    });
    push(KEY_DATE_TITLE_TRAVEL_INSURANCE, "📋", -14, {
      category: "admin",
      description:
        "Make sure your policy covers the trip dates and activities.",
    });
  } else if (REGION_TIER_UNIVERSAL_INTL.has(rid)) {
    push(KEY_DATE_TITLE_UNIVERSAL_EXPRESS, "🎢", -14, {
      category: "booking",
      description:
        "Book Universal park tickets or express products via official resort channels.",
    });
    push(KEY_DATE_TITLE_ONLINE_CHECKIN, "✈️", -1, {
      category: "travel",
      description:
        "Most airlines open check-in 24 hours before departure.",
    });
    push(KEY_DATE_TITLE_TRAVEL_INSURANCE, "📋", -14, {
      category: "admin",
      description:
        "Make sure your policy covers the trip dates and activities.",
    });
  } else if (!isUkDomesticRegion(rid, params.region_country_code)) {
    push(KEY_DATE_TITLE_ONLINE_CHECKIN, "✈️", -1, {
      category: "travel",
      description:
        "Most airlines open check-in 24 hours before departure.",
    });
    push(KEY_DATE_TITLE_TRAVEL_INSURANCE, "📋", -14, {
      category: "admin",
      description:
        "Make sure your policy covers the trip dates and activities.",
    });
  }

  if (
    has_cruise &&
    !haveTitle.has(KEY_DATE_TITLE_TRAVEL_INSURANCE)
  ) {
    push(KEY_DATE_TITLE_TRAVEL_INSURANCE, "📋", -14, {
      category: "admin",
      description:
        "Make sure your policy covers the trip dates and activities.",
    });
  }

  return out.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return a.sort_order - b.sort_order;
  });
}

export function hydrateSeedTemplatesWithIds(templates: Omit<KeyDate, "id">[]): KeyDate[] {
  return templates.map((t) => ({
    ...t,
    id: crypto.randomUUID(),
  }));
}

export function mergeSuggestedTemplatesIntoExisting(
  existing: KeyDate[],
  params: SeedTripParams,
): KeyDate[] {
  const titles = new Set(existing.map((e) => e.title.trim()));
  const templates = computeSeedTemplates(params);
  const base = [...existing];
  let mo = Math.max(0, ...base.map((e) => e.sort_order ?? 0));
  for (const row of templates) {
    const t = row.title.trim();
    if (titles.has(t)) continue;
    mo += 10;
    base.push({
      ...row,
      id: crypto.randomUUID(),
      sort_order: mo,
    });
    titles.add(t);
  }
  return base.sort((a, b) => sortKeyDatesCmp(a, b));
}

export function tripHasApplicableSuggestedSeeds(
  trip: Trip,
  regionCountryCode?: string | null,
): boolean {
  return (
    computeSeedTemplates({
      ...trip,
      region_country_code: regionCountryCode ?? null,
    }).length > 0
  );
}

function sortKeyDatesCmp(a: KeyDate, b: KeyDate): number {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (so !== 0) return so;
  return a.id.localeCompare(b.id);
}

/** User + autos combined, chronological. */
export function getMergedKeyDatesSorted(trip: Trip): KeyDate[] {
  const user = readUserKeyDates(trip.preferences).filter((k) =>
    /^\d{4}-\d{2}-\d{2}$/.test(k.date),
  );
  const auto = getAutoKeyDates(trip);
  const merged = [...user, ...auto];
  merged.sort(sortKeyDatesCmp);
  return merged;
}

export function titleKey(title: string): string {
  return title.trim().toLowerCase();
}

/** Planner hero (“Next milestone” text). Same sort as consolidated list. */
export function buildPlannerKeyDateRowsSorted(trip: Trip): PlannerKeyDateRow[] {
  return getMergedKeyDatesSorted(trip).map((k) => ({
    id: k.id,
    icon: k.icon,
    label: k.title,
    dateKey: k.date,
    notes: k.description,
  }));
}

export type ValidateKeyDateInput =
  | { mode: "create"; draft: DraftKeyDate }
  | { mode: "update"; id: string; patch: DraftKeyDate };

export type DraftKeyDate = {
  title: string;
  icon: string;
  description?: string;
  date: string;
  category?: KeyDateCategory | "" | null;
};

export type KeyDateValidationIssue = { ok: false; error: string } | { ok: true };

export function validateDraftKeyDate(draft: DraftKeyDate): KeyDateValidationIssue {
  const title = draft.title.trim();
  if (title.length < 1 || title.length > 200) {
    return { ok: false, error: "Title must be 1–200 characters." };
  }
  const icon = draft.icon.trim();
  if (icon.length < 1 || icon.length > 30) {
    return { ok: false, error: "Pick a short icon / emoji." };
  }
  const date = draft.date.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Pick a calendar date." };
  }
  if (draft.description != null && draft.description.length > 300) {
    return { ok: false, error: "Description must be under 300 characters." };
  }
  return { ok: true };
}

/** Insert or replace user-owned row immutably in preferences-shaped object (client optimistic). */
export function applyKeyDatesToPrefs(
  prefs: Record<string, unknown> | undefined,
  rows: KeyDate[],
): Record<string, unknown> {
  const base =
    prefs && typeof prefs === "object" && !Array.isArray(prefs)
      ? { ...prefs }
      : {};
  return { ...base, key_dates: rows };
}
