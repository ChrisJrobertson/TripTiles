import { getTierConfig } from "@/lib/tiers";
import { createClient } from "@/lib/supabase/server";
import { readProfileRow, tierFromProfileRow } from "@/lib/supabase/profile-read";
import type { UserTier } from "@/lib/types";
import { TierError } from "@/lib/tier-errors";

type SubRow = { status: string; tier: string; grace_until: string | null };

function activeStripeModel(row: SubRow | null): "haiku" | "sonnet" | null {
  if (!row) return null;
  const s = row.status;
  if (s === "active" || s === "trialing") {
    return row.tier === "captain" ? "sonnet" : "haiku";
  }
  if (s === "past_due") {
    const grace = row.grace_until;
    if (grace && new Date(grace).getTime() > Date.now()) {
      return row.tier === "captain" ? "sonnet" : "haiku";
    }
  }
  return null;
}

/**
 * Resolves the Anthropic model id for Tripp (no cache — reflects upgrades immediately).
 * Active Stripe subscriptions use Navigator/Captain price tiers; Payhip-era profiles
 * keep their configured model (Pro/Family Haiku, Premium Sonnet).
 */
export async function resolveTrippModel(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("user_subscriptions")
    .select("status, tier, grace_until, updated_at")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = (rows?.[0] ?? null) as SubRow | null;
  const fromStripe = activeStripeModel(row);
  if (fromStripe === "haiku") return "claude-haiku-4-5";
  if (fromStripe === "sonnet") return "claude-sonnet-4-6";

  const pr = await readProfileRow<{ tier: string }>(supabase, userId, "tier");
  if (!pr.ok) {
    throw new Error(`TIER_LOAD_FAILED: ${pr.message}`);
  }
  const profileTier = tierFromProfileRow(pr.data) as UserTier;
  if (profileTier === "free") {
    throw new TierError(
      "TIER_AI_DISABLED",
      "Tripp is not available on the Day Tripper plan.",
    );
  }
  return getTierConfig(profileTier).features.ai_model;
}
