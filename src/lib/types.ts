/**
 * Application types aligned with `triptiles_supabase_schema.sql`.
 * Regenerate or adjust when the canonical SQL schema is available in-repo.
 */

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
  tier: UserTier;
  referral_code: string;
  referred_by: string | null;
  agency_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Effective tier from `user_effective_tier` view (shape may mirror Profile + computed tier) */
export interface UserEffectiveTierRow {
  user_id: string;
  effective_tier: UserTier;
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

export type Assignment = Partial<Record<SlotType, string>>;

/** Date keys: `${year}-${month}-${day}` without zero-padding (e.g. "2026-8-17"). */
export type Assignments = Record<string, Assignment>;

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
}

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
  is_public: boolean;
  public_slug: string | null;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
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
  ai_generations_lifetime: number;
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
  error_message: string | null;
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
