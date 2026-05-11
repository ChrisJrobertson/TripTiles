import { formatDateISO, parseDate } from "@/lib/date-helpers";
import type {
  Attraction,
  AttractionCategory,
  AttractionVerificationStatus,
  AttractionVerifiedBy,
  RidePriority,
  SkipLineSystem,
  SkipLineTier,
  ThrillLevel,
  TripRidePriority,
} from "@/types/attractions";

export function mapAttractionRow(r: Record<string, unknown>): Attraction {
  const tags = r.tags;
  const verifiedAtRaw = r.verified_at;
  const verifiedAtStr =
    verifiedAtRaw == null
      ? null
      : String(verifiedAtRaw).slice(0, 10);
  const verifiedByRaw = r.verified_by;
  const verifiedBy: AttractionVerifiedBy | null =
    verifiedByRaw === "official_site" ||
    verifiedByRaw === "manual_review" ||
    verifiedByRaw === "community_crowdsource"
      ? verifiedByRaw
      : null;
  const verificationRaw = r.verification_status;
  const verificationStatus: AttractionVerificationStatus =
    verificationRaw === "verified" ||
    verificationRaw === "partial" ||
    verificationRaw === "unverified" ||
    verificationRaw === "retired"
      ? verificationRaw
      : "unverified";
  const vq = r.virtual_queue;
  return {
    id: String(r.id),
    park_id: String(r.park_id),
    name: String(r.name),
    category: (r.category as AttractionCategory) ?? "ride",
    height_requirement_cm:
      r.height_requirement_cm == null
        ? null
        : Number(r.height_requirement_cm),
    height_requirement_accompanied_cm:
      r.height_requirement_accompanied_cm == null
        ? null
        : Number(r.height_requirement_accompanied_cm),
    min_age_years:
      r.min_age_years == null ? null : Number(r.min_age_years),
    thrill_level: (r.thrill_level as ThrillLevel) ?? "moderate",
    is_indoor: Boolean(r.is_indoor),
    duration_minutes:
      r.duration_minutes == null ? null : Number(r.duration_minutes),
    skip_line_system: (r.skip_line_system as SkipLineSystem | null) ?? null,
    skip_line_tier: (r.skip_line_tier as SkipLineTier | null) ?? null,
    skip_line_notes:
      r.skip_line_notes == null ? null : String(r.skip_line_notes),
    avg_wait_peak_minutes:
      r.avg_wait_peak_minutes == null
        ? null
        : Number(r.avg_wait_peak_minutes),
    avg_wait_offpeak_minutes:
      r.avg_wait_offpeak_minutes == null
        ? null
        : Number(r.avg_wait_offpeak_minutes),
    best_time_to_ride:
      r.best_time_to_ride == null ? null : String(r.best_time_to_ride),
    sort_order: Number(r.sort_order ?? 0),
    is_seasonal: Boolean(r.is_seasonal),
    is_temporarily_closed: Boolean(r.is_temporarily_closed),
    closure_note: r.closure_note == null ? null : String(r.closure_note),
    tags: Array.isArray(tags) ? tags.map(String) : [],
    official_url: r.official_url == null ? null : String(r.official_url),
    virtual_queue:
      vq === undefined || vq === null ? null : Boolean(vq),
    typical_closure_weeks:
      r.typical_closure_weeks == null
        ? null
        : String(r.typical_closure_weeks),
    verification_status: verificationStatus,
    verified_at: verifiedAtStr,
    verified_by: verifiedBy,
    source_url: r.source_url == null ? null : String(r.source_url),
  };
}

export function mapPriorityRow(
  r: Record<string, unknown>,
  attraction?: Attraction,
): TripRidePriority {
  return {
    id: String(r.id),
    trip_id: String(r.trip_id),
    attraction_id: String(r.attraction_id),
    day_date: formatDateISO(parseDate(String(r.day_date).slice(0, 10))),
    priority: (r.priority as RidePriority) ?? "must_do",
    sort_order: Number(r.sort_order ?? 0),
    notes: r.notes == null ? null : String(r.notes),
    skip_line_return_hhmm:
      r.skip_line_return_hhmm == null
        ? null
        : String(r.skip_line_return_hhmm),
    pasted_queue_minutes:
      r.pasted_queue_minutes == null
        ? null
        : Number.isFinite(Number(r.pasted_queue_minutes))
          ? Math.min(600, Math.max(0, Number(r.pasted_queue_minutes)))
          : null,
    created_at: String(r.created_at ?? ""),
    attraction,
  };
}
