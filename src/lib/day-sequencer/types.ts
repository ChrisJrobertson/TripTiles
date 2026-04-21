import type { Attraction, TripRidePriority } from "@/types/attractions";

/** UI / product pace; maps from `TripPlanningPreferences.pace` via `planningPaceToSequencerPace`. */
export type SequencerPace = "relaxed" | "balanced" | "go-go-go";

export type AnchorType =
  | "lightning_lane"
  | "dining_reservation"
  | "express_now"
  | "character_meet"
  | "show"
  | "other";

export interface DayAnchor {
  id: string;
  attraction_id?: string | null;
  name: string;
  /** Local day time `HH:mm` (24h). */
  start_time: string;
  end_time: string;
  type: AnchorType;
}

export interface DayEntitlements {
  has_lightning_lane_multi_pass: boolean;
  has_lightning_lane_single_pass: boolean;
  has_universal_express: boolean;
  has_early_entry: boolean;
}

/** Optional catalogue fields not stored on `Attraction` today — supply for Epic rope-drop copy and seasonal months. */
export interface AttractionSequencerMeta {
  /** Land / portal for Epic Universe rope-drop messaging. */
  land?: string | null;
  land_portal?: string | null;
  /** 1–12 inclusive; when `is_seasonal` and set, ride is kept only in these months. */
  season_months?: number[] | null;
  /** When omitted, derived from peak/off-peak waits. */
  avg_wait_ropedrop_minutes?: number | null;
  avg_wait_evening_minutes?: number | null;
}

export interface GenerateParkDaySequenceInput {
  date: string;
  /** Parks visited that day (e.g. `mk`, up to three for Universal multi-park). */
  park_ids: string[];
  entitlements: DayEntitlements;
  pace: SequencerPace;
  /** When true, V1 height rule: exclude rides with `height_requirement_cm >= 112`. */
  young_child_party_v1: boolean;
  /** When set, smallest rider height in cm overrides the 112cm V1 rule for height filtering. */
  smallest_rider_height_cm?: number | null;
  date_is_peak_season: boolean;
  /** Minutes from midnight for park open / close (single window for V1). */
  park_open_minutes: number;
  park_close_minutes: number;
  anchors: DayAnchor[];
  /** User priorities for the day, pre-sorted (`sortPrioritiesForDay`). */
  priorities: TripRidePriority[];
  attractions_by_id: Record<string, Attraction>;
  attraction_meta_by_id?: Record<string, AttractionSequencerMeta>;
}

export type SequenceRideItem = {
  order: number;
  time_estimate: string;
  attraction_id: string;
  type: "ride";
  expected_wait_band: string;
  note: string | null;
};

export type SequenceAnchorItem = {
  order: number;
  time_estimate: string;
  type: "anchor";
  anchor_id: string;
  name: string;
  time_window: string;
  note: string | null;
};

export type ParkDaySequenceItem = SequenceRideItem | SequenceAnchorItem;

export interface ParkDaySequenceOutput {
  day_type: "park";
  park: string;
  rope_drop_recommendation: string;
  sequence: ParkDaySequenceItem[];
  /** One human-readable line per honoured anchor. */
  anchor_confirmations: string[];
  /** Joined summary for compact UI (same content as `anchor_confirmations`). */
  anchor_confirmation: string;
  pace_applied: SequencerPace;
  warnings: string[];
  dining_suggestions: string[];
}

export type DaySequencerErrorCode =
  | "ANCHORS_OVERLAP"
  | "ANCHOR_ATTRACTION_WRONG_PARK";

export type GenerateParkDaySequenceResult =
  | { ok: true; output: ParkDaySequenceOutput }
  | { ok: false; code: DaySequencerErrorCode; message: string };
