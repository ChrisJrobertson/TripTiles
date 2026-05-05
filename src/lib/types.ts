/**
 * Application types aligned with `triptiles_supabase_schema.sql`.
 * Regenerate or adjust when the canonical SQL schema is available in-repo.
 */

import type { ThemeKey } from "@/lib/themes";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Matches typical `profiles.tier` + agency roles from the product spec */
export type UserTier =
  | "free"
  | "pro"
  | "family"
  | "premium"
  | "concierge"
  | "agent_admin"
  | "agent_staff";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "paused";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  /** When true, skip marketing-style emails including trip milestone reminders. */
  email_marketing_opt_out?: boolean;
  tier: UserTier;
  referral_code: string;
  referred_by: string | null;
  agency_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agency {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  subscription_status: SubscriptionStatus | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  max_seats: number | null;
  max_client_trips: number | null;
  booking_com_aid: string | null;
  viator_pid: string | null;
  created_at: string;
  updated_at: string;
}

/** Planner / DB trip row (`trips` table). */
export type SlotType = "am" | "pm" | "lunch" | "dinner";

export type Destination =
  | "orlando"
  | "paris"
  | "tokyo"
  | "cali"
  | "cruise"
  | "custom";

/** Slot payload: legacy string = park id only, or object with optional start time (HH:mm). */
export type SlotAssignmentValue =
  | string
  | { parkId: string; time?: string };

export type Assignment = Partial<Record<SlotType, SlotAssignmentValue>>;

/** Date keys: zero-padded `YYYY-MM-DD` (matches `formatDateISO`). */
export type Assignments = Record<string, Assignment>;

/** Wizard / Smart Plan pacing choice. */
export type PlanningPace = "relaxed" | "balanced" | "intense" | "go_go_go";

/** Pro/Family AI Day Strategy gate (reserved `limit_reached` for future caps). */
export type AIDayStrategyEntitlement = "allowed" | "tier_blocked" | "limit_reached";

export type DayPlanningParkAction =
  | "keep_existing"
  | "change_park"
  | "add_park"
  | "rest_day"
  | "suggest";

export type DayPlanningDayType =
  | "thrill_heavy"
  | "balanced_family"
  | "lower_thrill"
  | "shows_food_exploring"
  | "shorter_easier"
  | "suggest";

export type DayPlanningRideLevel =
  | "big_thrills"
  | "some_thrills"
  | "gentle"
  | "shows_lands_food";

export type DayPlanningMealPreference =
  | "do_not_plan"
  | "quick_service"
  | "table_service"
  | "mixed"
  | "snacks"
  | "existing_only"
  | "suggest";

export type DayPlanningPace = "packed" | "balanced" | "relaxed" | "half_day";

export type DayPlanningStartPreference =
  | "rope_drop"
  | "normal_morning"
  | "slow_start"
  | "afternoon";

export type DayPlanningFinishPreference =
  | "after_lunch"
  | "mid_afternoon"
  | "early_evening"
  | "night_atmosphere"
  | "close";

export type DayPlanningPaidAccess = "yes" | "no" | "not_sure" | "decide_later";

export type DayPlanningChangePermission =
  | "fill_gaps_only"
  | "add_around_existing"
  | "reorder_unlocked"
  | "replace_ai_only"
  | "start_again";

/** Trip Intelligence — `trips.preferences.trip_planning_profile` (learned planner context). */
export type TripPlanningPartyType =
  | "solo"
  | "couple"
  | "family"
  | "friends"
  | "multi_generational"
  | "unknown";

/** How far the party wants to push ride intensity versus comfort. */
export type TripRideTolerance =
  | "thrill_seeker"
  | "moderate_thrills"
  | "mostly_gentle"
  | "minimal_motion"
  | "unknown";

export type TripIntelligenceWalkingPreference =
  | "prefer_less_walking"
  | "balanced"
  | "happy_to_walk"
  | "unknown";

export type TripIntelligencePacePreference =
  | PlanningPace
  | "unknown";

export type TripIntelligenceMealPreference =
  | "do_not_plan"
  | "quick_service"
  | "table_service"
  | "mixed"
  | "snacks"
  | "unknown";

export type TripIntelligenceQueuePreference =
  | "avoid_long_queues"
  | "balanced"
  | "willing_to_wait"
  | "unknown";

export type TripPlanningProfile = {
  partyType: TripPlanningPartyType;
  rideTolerance: TripRideTolerance;
  avoidances: string[];
  walkingPreference: TripIntelligenceWalkingPreference;
  pacePreference: TripIntelligencePacePreference;
  mealPreference: TripIntelligenceMealPreference;
  queuePreference: TripIntelligenceQueuePreference;
  /** Compact keys or tags the system has picked up from behaviour (kept small for JSONB). */
  learnedSignals: string[];
  updatedAt: string;
};

export type DayPlanFeedbackReason =
  | "too_packed"
  | "too_relaxed"
  | "wrong_park_mix"
  | "missed_priorities"
  | "not_accurate"
  | "other"
  | "unspecified";

/** One rating after viewing a generated day plan — `trips.preferences.day_plan_feedback[date]`. */
export type DayPlanFeedback = {
  tripId: string;
  date: string;
  generatedAt: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedbackReason: DayPlanFeedbackReason;
  freeText: string;
  createdAt: string;
};

export type BehaviourSignalType =
  | "planner_opened"
  | "planner_submitted"
  | "day_plan_viewed"
  | "day_plan_regenerated"
  | "day_plan_exported"
  | "feedback_submitted"
  | "attraction_excluded"
  | "attraction_priority_set"
  | "other";

export type BehaviourSignalSource = "ui" | "server" | "ai" | "system";

/** Single discrete signal — stored in `trips.preferences.behaviour_signals` (array). */
export type BehaviourSignal = {
  tripId: string;
  date: string | null;
  signalType: BehaviourSignalType;
  source: BehaviourSignalSource;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DayPlanningIntent = {
  parkAction: DayPlanningParkAction;
  selectedParkIds: string[];
  dayType: DayPlanningDayType;
  rideLevel: DayPlanningRideLevel;
  avoid: string[];
  mealPreference: DayPlanningMealPreference;
  pace: DayPlanningPace;
  startPreference: DayPlanningStartPreference;
  finishPreference: DayPlanningFinishPreference;
  paidAccess: DayPlanningPaidAccess;
  mustInclude: string;
  mustAvoid: string;
  changePermission: DayPlanningChangePermission;
  completedAt?: string;
};

export type PlanningMobility =
  | "none"
  | "stroller"
  | "wheelchair"
  | "prefer_shorter_walks";

export type PlanningTripType =
  | "first_timer"
  | "repeat_visitor"
  | "milestone"
  | "honeymoon"
  | "multi_generational"
  | "unsure";

export type PlanningMustDoExperience =
  | "character_meals"
  | "fireworks"
  | "parades"
  | "dessert_party"
  | "rope_drop"
  | "evening_extra";

export type PlanningChildHeight = {
  ageOrIndex: number;
  heightCm: number;
};

export type PlanningDisneyLightningLane = {
  multiPassStatus: "all_park_days" | "some_park_days" | "none" | "not_sure";
  singlePassWillingToPay: "yes" | "no" | "not_sure";
  memoryMaker: "yes" | "no" | "not_sure";
};

export type PlanningUniversalExpress = {
  status: "included_with_hotel" | "paid" | "no" | "not_sure";
  singleRiderOk: "yes" | "no" | "sometimes";
};

export type AIDayStrategyRideStepType =
  | "rope_drop"
  | "standby"
  | "lightning_lane"
  | "single_rider"
  | "express_pass"
  | "meal"
  | "show"
  | "indoor_break"
  | "rest"
  | "shopping";

export type AIDayStrategyArrival = "rope_drop" | "mid_morning" | "afternoon";

/** Paid Pro/Family output keyed by date under `trips.preferences.ai_day_strategy`. */
export type AIDayStrategy = {
  date: string;
  park: string;
  generated_at: string;
  model: string;
  arrival_recommendation: AIDayStrategyArrival;
  arrival_reason: string;
  ride_sequence: Array<{
    time: string;
    type: AIDayStrategyRideStepType;
    ride_or_event: string;
    notes: string;
    height_warning?: string;
  }>;
  lightning_lane_strategy?: {
    multi_pass_bookings: Array<{
      ride: string;
      book_for_time: string;
      reason: string;
    }>;
    single_pass_recommendations?: string[];
  };
  express_pass_strategy?: {
    priority_rides: string[];
    skip_with_express: string[];
  };
  warnings: string[];
  /** Populated when output was normalised or degraded — show a gentle banner in UI. */
  quality_warnings?: string[];
  /**
   * Suggestions that could not be tied to catalogue rows (wrong park / unknown name).
   * Not part of the main sequenced plan.
   */
  optional_sequence_notes?: string[];
};

export type DaySnapshotSource =
  | "ai_day_tweak"
  | "ai_day_smart_suggest"
  | "ai_day_freetext"
  | "ai_day_strategy";

export type DaySnapshotPreferencesSubset = {
  ai_day_timeline?: unknown;
  ai_day_crowd_notes?: string;
  day_notes?: string;
  /** Single-day value merged into `preferences.ai_day_strategy[date]`. */
  ai_day_strategy?: AIDayStrategy | null;
};

export type DaySnapshot = {
  date: string;
  before: {
    assignments_for_day: Assignment;
    preferences_subset: DaySnapshotPreferencesSubset;
  };
  after: {
    assignments_for_day: Assignment;
    preferences_subset: DaySnapshotPreferencesSubset;
  };
  model: string;
  created_at: string;
  source: DaySnapshotSource;
};

/** Stored on `trips.planning_preferences` for Smart Plan context and modal pre-fill. */
export interface TripPlanningPreferences {
  pace: PlanningPace;
  mustDoParks: string[];
  priorities: string[];
  additionalNotes: string | null;
  adults: number;
  children: number;
  childAges: number[];
  /**
   * When false, Smart Plan and day ride hints omit Disney Lightning Lane /
   * Multi Pass style tactical copy. Default true when omitted (backwards compatible).
   */
  includeDisneySkipTips?: boolean;
  /**
   * When false, Smart Plan and day ride hints omit Universal Express-style copy.
   * Default true when omitted.
   */
  includeUniversalSkipTips?: boolean;

  /** Wizard Step 3 — heights per child for ride warnings. */
  childHeights?: PlanningChildHeight[];
  mobility?: PlanningMobility;
  /** Wizard Step 4. */
  tripType?: PlanningTripType;
  /** Wizard Step 5 — structured must-dos beyond priority tags. */
  mustDoExperiences?: PlanningMustDoExperience[];
  /** Wizard Step 6 — Disney regions only. */
  disneyLightningLane?: PlanningDisneyLightningLane;
  /** Wizard Step 6 — Universal regions only. */
  universalExpress?: PlanningUniversalExpress;
  /** Wizard Step 7. */
  parkHopping?: "yes" | "no" | "undecided";
  expectedFullParkDays?: number;
}

/** Per-day AI hour-by-hour plan (stored under `trips.preferences.ai_day_timeline[dateKey]`). */
export type AiDayTimelineModelId = "haiku-4.5" | "sonnet-4.6";
export type AiDayTimelineBlock =
  | "morning"
  | "lunch"
  | "afternoon"
  | "dinner"
  | "evening";
export type AiDayTimelineRowTag =
  | "priority"
  | "show"
  | "adr"
  | "break"
  | "transport";

export type AiDayTimeline = {
  generated_at: string;
  model: AiDayTimelineModelId;
  park_hours: { open: string; close: string };
  timeline: Array<{
    time: string;
    block: AiDayTimelineBlock;
    title: string;
    subtitle?: string;
    tag?: AiDayTimelineRowTag;
  }>;
  heat_plan?: string;
  transport?: string;
  must_do: string[];
};

/**
 * Documented shape for `trips.preferences` (JSONB). The `Trip` type still uses
 * `Record<string, unknown>` for forward compatibility.
 */
export type TripPreferences = {
  ai_crowd_summary?: string;
  ai_crowd_updated_at?: string;
  ai_day_crowd_notes?: Record<string, string>;
  /** Model echo of guest skip-line return times (structured contract); never invent. */
  ai_skip_line_return_echo?: Record<
    string,
    Array<{ attraction_id: string; hhmm: string }>
  >;
  ai_day_timeline?: Record<string, AiDayTimeline>;
  /** Pro/Family sequenced ride strategy per calendar day (`YYYY-MM-DD`). */
  ai_day_strategy?: Record<string, AIDayStrategy>;
  ai_day_intent?: Record<string, DayPlanningIntent>;
  day_notes?: Record<string, string>;
  must_dos?: unknown;
  must_dos_snapshot?: unknown;
  /** Hex color for the editable “adventure” segment of the trip title; null/omitted = default royal. */
  adventure_title_color?: string | null;
  /** Learned / curated planner profile for recommendations (Trip Intelligence Layer). */
  trip_planning_profile?: TripPlanningProfile;
  /** Guest feedback on generated day plans keyed by `YYYY-MM-DD`. */
  day_plan_feedback?: Record<string, DayPlanFeedback>;
  /** Append-only style behaviour signals (bounded in app code when sampling). */
  behaviour_signals?: BehaviourSignal[];
};

export interface Region {
  id: string;
  name: string;
  short_name: string;
  country: string;
  country_code: string;
  continent: string;
  flag_emoji: string | null;
  description: string | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
}

export interface Park {
  id: string;
  name: string;
  icon: string | null;
  bg_colour: string;
  fg_colour: string;
  park_group: string;
  destinations: Destination[];
  region_ids: string[];
  is_custom: boolean;
  sort_order: number;
  /** Optional table booking deep link (named restaurant tiles). */
  affiliate_ticket_url?: string | null;
  /** Park operating hours / closure information (verification). */
  official_url?: string | null;
}

/** User-created palette tile (`custom_tiles` table). */
export interface CustomTile {
  id: string;
  user_id: string;
  name: string;
  park_group: string;
  bg_colour: string;
  fg_colour: string;
  region_ids: string[];
  save_to_library: boolean;
  icon: string | null;
  notes: string | null;
  address: string | null;
  url: string | null;
  trips_used_count: number;
  created_at: string;
  updated_at: string;
}

/** Unified shape for palette rendering (built-in park or custom tile). */
export interface PaletteItem {
  id: string;
  name: string;
  icon: string | null;
  bg_colour: string;
  fg_colour: string;
  park_group: string;
  is_custom: boolean;
  notes?: string | null;
}

export function parkToPaletteItem(park: Park): PaletteItem {
  return {
    id: park.id,
    name: park.name,
    icon: park.icon,
    bg_colour: park.bg_colour,
    fg_colour: park.fg_colour,
    park_group: park.park_group,
    is_custom: park.is_custom,
    notes: null,
  };
}

export function customTileToPaletteItem(tile: CustomTile): PaletteItem {
  return {
    id: tile.id,
    name: tile.name,
    icon: tile.icon,
    bg_colour: tile.bg_colour,
    fg_colour: tile.fg_colour,
    park_group: tile.park_group,
    is_custom: true,
    notes: tile.notes,
  };
}

/** Map a custom DB row to a `Park` for calendar / AI guardrails. */
export function customTileToPark(tile: CustomTile): Park {
  return {
    id: tile.id,
    name: tile.name,
    icon: tile.icon,
    bg_colour: tile.bg_colour,
    fg_colour: tile.fg_colour,
    park_group: tile.park_group,
    destinations: [],
    region_ids: tile.region_ids ?? [],
    is_custom: true,
    sort_order: 10000,
    affiliate_ticket_url: null,
    official_url: tile.url == null || tile.url === "" ? null : String(tile.url),
  };
}

export type BudgetCategory =
  | "flights"
  | "accommodation"
  | "tickets"
  | "dining"
  | "transport"
  | "insurance"
  | "cruise"
  | "shopping"
  | "other";

export interface TripBudgetItem {
  id: string;
  trip_id: string;
  category: BudgetCategory;
  label: string;
  amount: number;
  currency: string;
  is_paid: boolean;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ChecklistCategory =
  | "packing_essentials"
  | "packing_clothing"
  | "packing_kids"
  | "packing_tech"
  | "before_you_go"
  | "at_the_park";

export interface TripChecklistItem {
  id: string;
  trip_id: string;
  category: ChecklistCategory;
  label: string;
  is_checked: boolean;
  is_custom: boolean;
  sort_order: number;
  created_at: string;
}

export type TemperatureUnit = "c" | "f";

export interface Trip {
  id: string;
  owner_id: string;
  agency_id: string | null;
  family_name: string;
  adventure_name: string;
  destination: Destination;
  /** Source of truth for palette & AI; `regions.id`. */
  region_id: string | null;
  start_date: string;
  end_date: string;
  has_cruise: boolean;
  cruise_embark: string | null;
  cruise_disembark: string | null;
  adults: number;
  children: number;
  child_ages: number[];
  assignments: Assignments;
  preferences: Record<string, unknown>;
  notes: string | null;
  /** Optional total trip budget (same currency as line items by convention). */
  budget_target: number | null;
  /** ISO currency code for display (amounts are not converted). */
  budget_currency: string;
  is_public: boolean;
  public_slug: string | null;
  /** Total clones of this trip (public viral loop). */
  clone_count?: number;
  /** Public plan page views (best-effort). */
  view_count?: number;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
  /** Set before each Smart Plan apply; used for single-step undo. */
  previous_assignments_snapshot?: Assignments | null;
  previous_preferences_snapshot?: Record<string, unknown> | null;
  previous_assignments_snapshot_at?: string | null;
  /** Last 3 day-scoped AI changes; powers per-day undo. */
  day_snapshots: DaySnapshot[];
  /** Smart Plan wizard answers; null if user chose manual-only creation. */
  planning_preferences: TripPlanningPreferences | null;
  /** Planner UI palette (`src/lib/themes.ts`). */
  colour_theme: ThemeKey;
  /** When false, milestone reminder emails are skipped for this trip. */
  email_reminders: boolean;
  /** First name + last initial for public gallery cards; set when publishing. */
  gallery_owner_label: string | null;
  /** Hidden from planner lists when archived after a tier downgrade. */
  is_archived?: boolean;
  archived_reason?: string | null;
}

export type AchievementCategory =
  | "milestone"
  | "trips"
  | "parks"
  | "destinations"
  | "days"
  | "social"
  | "loyalty";

export interface Achievement {
  id: string;
  user_id: string;
  achievement_key: string;
  earned_at: string;
  metadata: Record<string, unknown>;
}

export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  threshold: number | null;
  sort_order: number;
}

export interface ProfileStats {
  trips_planned_count: number;
  days_planned_count: number;
  parks_visited_count: number;
  templates_cloned_count: number;
  tier: UserTier;
}

/** Data collected by the trip wizard (steps 1–4). */
export type WizardData = {
  family_name: string;
  adventure_name: string;
  start_date: string;
  end_date: string;
  region_id: string;
  /** Legacy enum, derived from `region_id` for DB compatibility. */
  destination: Destination;
  has_cruise: boolean;
  cruise_embark: string | null;
  cruise_disembark: string | null;
};

export type PurchaseStatus = "pending" | "completed" | "refunded" | "failed";

export interface Purchase {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  agency_id: string | null;
  provider: string;
  provider_order_id: string;
  product_link: string | null;
  amount: number | null;
  currency: string | null;
  status: PurchaseStatus;
  raw_payload: Json | null;
  created_at: string;
}

export interface AiGeneration {
  id: string;
  user_id: string;
  trip_id: string;
  prompt: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_gbp_pence: number | null;
  success: boolean | null;
  /** DB column name in Supabase (`ai_generations.error`). */
  error: string | null;
  created_at: string;
}

export type ConciergeRequestStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface ConciergeRequest {
  id: string;
  user_id: string;
  trip_id: string | null;
  purchase_id: string | null;
  status: ConciergeRequestStatus;
  intake: Json | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type AffiliateProductType = "hotel" | "tickets" | "excursion" | "other";

export interface AffiliateClick {
  id: string;
  provider: string;
  product_type: AffiliateProductType | null;
  tile_id: string | null;
  trip_id: string | null;
  target_url: string | null;
  user_id: string | null;
  ip_hash: string | null;
  created_at: string;
}

export type AffiliateConversionStatus = "pending" | "confirmed" | "rejected";

export interface AffiliateConversion {
  id: string;
  provider: string;
  external_id: string | null;
  amount: number | null;
  currency: string | null;
  status: AffiliateConversionStatus;
  raw_payload: Json | null;
  created_at: string;
}

export type TripCollaboratorRole = "editor" | "viewer";

export type TripCollaboratorStatus = "pending" | "accepted" | "declined" | "revoked";

export interface TripCollaborator {
  id: string;
  trip_id: string;
  user_id: string | null;
  email: string | null;
  role: TripCollaboratorRole;
  status: TripCollaboratorStatus;
  invite_token: string | null;
  created_at: string;
  updated_at: string;
}

export type EmailQueueStatus = "scheduled" | "sent" | "failed" | "cancelled";

export interface EmailQueueRow {
  id: string;
  user_id: string;
  trip_id: string | null;
  template: string;
  scheduled_for: string;
  status: EmailQueueStatus;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}
