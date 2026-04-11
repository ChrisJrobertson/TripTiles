import type { UserTier } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Payhip product permalink (lowercase) → TripTiles `profiles.tier`. */
export const PAYHIP_PRODUCT_TO_TIER: Record<string, UserTier> = {
  h9hni: "pro",
  "9dxkb": "family",
  "76jpy": "premium",
};

export type PayhipWebhookBody = {
  id?: string;
  type?: string;
  email?: string;
  signature?: string;
  product_link?: string;
  price?: number;
  amount_refunded?: number;
  [key: string]: unknown;
};

function normalizeProductKey(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const slug = s.includes("/") ? s.replace(/^.*\//, "") : s;
  return slug.toLowerCase();
}

export function tierFromPayhipProductLink(
  productLink: unknown,
): UserTier | null {
  const key = normalizeProductKey(productLink);
  if (!key) return null;
  return PAYHIP_PRODUCT_TO_TIER[key] ?? null;
}

/** Match Payhip product title when permalink slug is absent or unknown. */
export function tierFromPayhipItemName(itemName: unknown): UserTier {
  const s = String(itemName ?? "").toLowerCase();
  if (s.includes("premium")) return "premium";
  if (s.includes("family")) return "family";
  if (s.includes("pro")) return "pro";
  console.warn(
    "[payhip] item_name did not clearly match a tier; defaulting to pro",
  );
  return "pro";
}

export function resolvePayhipPurchaseTier(
  productLink: unknown,
  itemName: unknown,
): UserTier {
  const fromLink = tierFromPayhipProductLink(productLink);
  if (fromLink) return fromLink;
  return tierFromPayhipItemName(itemName);
}

export function buyerEmailFromPayload(
  body: PayhipWebhookBody | Record<string, unknown>,
): string | null {
  const e = body.email;
  if (typeof e === "string" && e.includes("@")) return e.trim();
  const alt = body["buyer_email"] ?? body["customer_email"];
  if (typeof alt === "string" && alt.includes("@")) return alt.trim();
  return null;
}

/** Whether this event should grant the tier from `product_link`. */
export function payhipEventGrantsAccess(type: string | undefined): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  if (t === "paid" || t === "sale") return true;
  if (t.includes("subscription")) {
    return (
      t.includes("created") ||
      t.includes("started") ||
      t.includes("activated") ||
      t === "subscription.created"
    );
  }
  return false;
}

/** Whether to revoke paid access (full refund or subscription ended). */
export function payhipEventRevokesAccess(
  body: PayhipWebhookBody,
  type: string | undefined,
): boolean {
  if (!type) return false;
  const t = type.toLowerCase();

  if (t === "refunded") {
    const price = Number(body.price ?? 0);
    const refunded = Number(body.amount_refunded ?? 0);
    if (price > 0 && refunded > 0 && refunded < price) {
      return false;
    }
    return true;
  }

  if (t.includes("subscription")) {
    return (
      t.includes("deleted") ||
      t.includes("cancelled") ||
      t.includes("canceled") ||
      t.includes("deactivated") ||
      t === "subscription.deleted"
    );
  }

  return false;
}

export async function setProfileTierByEmail(
  admin: SupabaseClient,
  email: string,
  tier: UserTier,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();

  const { data: rows, error } = await admin
    .from("profiles")
    .update({
      tier,
      updated_at: new Date().toISOString(),
    })
    .ilike("email", normalized)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }
  const row = rows?.[0];
  if (!row?.id) {
    return {
      ok: false,
      error:
        "No profile row for this email. The buyer must sign in to TripTiles with the same email used at checkout.",
    };
  }
  return { ok: true, userId: row.id as string };
}
