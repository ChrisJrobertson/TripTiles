export type AttractionCategory =
  | "ride"
  | "show"
  | "character_meet"
  | "experience";

export type ThrillLevel = "gentle" | "moderate" | "thrilling" | "intense";

export type SkipLineSystem = "disney_lightning_lane" | "universal_express";

export type SkipLineTier =
  | "single_pass"
  | "multi_pass_tier1"
  | "multi_pass_tier2"
  | "express"
  | "express_now";

export type RidePriority = "must_do" | "if_time";

export interface Attraction {
  id: string;
  park_id: string;
  name: string;
  category: AttractionCategory;
  height_requirement_cm: number | null;
  thrill_level: ThrillLevel;
  is_indoor: boolean;
  duration_minutes: number | null;
  skip_line_system: SkipLineSystem | null;
  skip_line_tier: SkipLineTier | null;
  skip_line_notes: string | null;
  avg_wait_peak_minutes: number | null;
  avg_wait_offpeak_minutes: number | null;
  best_time_to_ride: string | null;
  sort_order: number;
  is_seasonal: boolean;
  is_temporarily_closed: boolean;
  closure_note: string | null;
  tags: string[];
  official_url: string | null;
}

export interface TripRidePriority {
  id: string;
  trip_id: string;
  attraction_id: string;
  day_date: string;
  priority: RidePriority;
  sort_order: number;
  notes: string | null;
  /** 24h Lightning Lane / Express return or booking time, e.g. "14:15". */
  skip_line_return_hhmm: string | null;
  /** Guest-pasted queue wait in minutes (board/app snapshot, not live). */
  pasted_queue_minutes: number | null;
  created_at: string;
  attraction?: Attraction;
}
