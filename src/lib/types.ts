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

export interface Trip {
  id: string;
  user_id: string;
  agency_id: string | null;
  family_name: string | null;
  adventure_name: string | null;
  start_date: string | null;
  end_date: string | null;
  destination: string | null;
  has_cruise: boolean | null;
  cruise_embark: string | null;
  cruise_disembark: string | null;
  adults: number | null;
  children: number | null;
  preferences: Json | null;
  assignments: Json | null;
  is_public: boolean | null;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
}

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
