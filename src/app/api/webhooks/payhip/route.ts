import { verifyPayhipWebhookSignature } from "@/lib/pricing/payhip-webhook";
import {
  buyerEmailFromPayload,
  payhipEventGrantsAccess,
  resolvePayhipPurchaseTier,
} from "@/lib/pricing/payhip-sync";
import { getTierConfig, shouldUpgradeTier, type Tier } from "@/lib/tiers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { NextResponse } from "next/server";

function safeEqualHex(a: string, b: string): boolean {
  try {
    const x = Buffer.from(a, "hex");
    const y = Buffer.from(b, "hex");
    if (x.length !== y.length) return false;
    return crypto.timingSafeEqual(x, y);
  } catch {
    return false;
  }
}

function verifyHmacSignature(
  rawBody: string,
  secret: string,
  request: Request,
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const headerCandidates = [
    request.headers.get("payhip-signature"),
    request.headers.get("x-payhip-signature"),
  ].filter(Boolean) as string[];
  for (const h of headerCandidates) {
    const cleaned = h.trim().replace(/^sha256=/i, "").trim();
    if (safeEqualHex(expected, cleaned)) return true;
    if (expected === cleaned) return true;
  }
  return false;
}

function parsePayload(
  rawBody: string,
  contentType: string | null,
): Record<string, unknown> {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    return JSON.parse(rawBody) as Record<string, unknown>;
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const out: Record<string, unknown> = {};
    for (const [k, v] of params.entries()) out[k] = v;
    return out;
  }
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    const params = new URLSearchParams(rawBody);
    const out: Record<string, unknown> = {};
    for (const [k, v] of params.entries()) out[k] = v;
    return out;
  }
}

function stringField(
  o: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function parsePriceToPence(raw: unknown): number {
  if (raw == null) return 0;
  const n =
    typeof raw === "number"
      ? raw
      : parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Payhip → TripTiles: verifies signature (HMAC of raw body or legacy JSON hash),
 * records purchases, upgrades tier with hierarchy, awards achievements.
 */
export async function POST(request: Request) {
  const secret = process.env.PAYHIP_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "PAYHIP_WEBHOOK_SECRET is not set. Add it to enable webhook verification.",
      },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const contentType = request.headers.get("content-type");

  const hmacOk = verifyHmacSignature(rawBody, secret, request);
  let parsed: Record<string, unknown>;
  try {
    parsed = parsePayload(rawBody, contentType);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const legacyOk = verifyPayhipWebhookSignature(parsed, secret);
  if (!hmacOk && !legacyOk) {
    console.error("[payhip webhook] signature verification failed", {
      headerKeys: [...request.headers.keys()].filter(
        (k) =>
          k.toLowerCase().includes("signature") ||
          k.toLowerCase().includes("payhip"),
      ),
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    console.error("[payhip webhook] service role client:", e);
    return NextResponse.json(
      { error: "server_misconfigured", detail: "SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    );
  }

  const type = stringField(parsed, "type") ?? undefined;

  if (!payhipEventGrantsAccess(type)) {
    console.info("[payhip webhook] ignored event type", { type });
    return NextResponse.json({ ok: true, ignored: true, type: type ?? null });
  }

  const email = buyerEmailFromPayload(parsed);

  if (!email) {
    return NextResponse.json(
      { ok: false, reason: "missing_email" },
      { status: 400 },
    );
  }

  const eventId =
    stringField(parsed, "txn_id", "transaction_id", "id") ?? "";
  if (eventId) {
    const { data: evDup } = await admin
      .from("payhip_webhook_events")
      .select("id")
      .eq("id", eventId)
      .maybeSingle();
    if (evDup?.id) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        id: eventId,
        message: "already processed",
      });
    }
    const { data: purDup } = await admin
      .from("purchases")
      .select("id")
      .eq("provider", "payhip")
      .eq("provider_order_id", eventId)
      .maybeSingle();
    if (purDup?.id) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        id: eventId,
        message: "already processed",
      });
    }
  }

  const itemName = stringField(parsed, "item_name", "product_name");
  const productLink = parsed["product_link"] ?? parsed["items[0][product_link]"];
  const receiptUrl = stringField(parsed, "receipt_url");
  const priceRaw =
    parsed["item_price"] ?? parsed["price"] ?? parsed["amount"];

  const newTier = resolvePayhipPurchaseTier(productLink, itemName);
  const amountPence = parsePriceToPence(priceRaw);

  const { data: profileRows, error: profErr } = await admin
    .from("profiles")
    .select("id, tier")
    .ilike("email", email.trim().toLowerCase())
    .limit(1);

  if (profErr) {
    console.error("[payhip webhook] profile lookup:", profErr.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const profile = profileRows?.[0] as
    | { id: string; tier: string | null }
    | undefined;

  if (!profile?.id) {
    if (eventId) {
      await admin.from("payhip_webhook_events").insert({
        id: eventId,
        event_type: type ?? null,
        email: email.trim().toLowerCase(),
      });
    }
    console.info("[payhip webhook] no profile for email; skipping tier upgrade");
    return NextResponse.json({
      ok: true,
      reason: "user_not_found",
      message:
        "No TripTiles account for this email — purchase not applied automatically.",
    });
  }

  const currentTier = (profile.tier ?? "free") as Tier;
  const upgraded = shouldUpgradeTier(currentTier, newTier);
  let achievementAwarded: string | null = null;

  if (upgraded) {
    const { error: upErr } = await admin
      .from("profiles")
      .update({
        tier: newTier,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (upErr) {
      console.error("[payhip webhook] tier update:", upErr.message);
      return NextResponse.json({ error: "db_error" }, { status: 500 });
    }

    const achKey = getTierConfig(newTier).achievement_key;
    if (achKey) {
      const { error: aErr } = await admin.from("achievements").insert({
        user_id: profile.id,
        achievement_key: achKey,
        earned_at: new Date().toISOString(),
        metadata: {},
      });
      if (aErr && aErr.code !== "23505") {
        console.error("[payhip webhook] achievement insert:", aErr.message);
      } else if (!aErr) {
        achievementAwarded = achKey;
      }
    }
  }

  const { error: purchaseErr } = await admin.from("purchases").insert({
    user_id: profile.id,
    product: newTier,
    amount_gbp_pence: amountPence > 0 ? amountPence : getTierConfig(newTier).price_pence,
    currency: "GBP",
    provider: "payhip",
    provider_order_id: eventId || null,
    provider_customer_id: null,
    status: "completed",
    metadata: {
      receipt_url: receiptUrl ?? null,
      payhip_type: type ?? null,
    },
  });

  if (purchaseErr) {
    console.error("[payhip webhook] purchase insert:", purchaseErr.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  if (eventId) {
    const { error: evErr } = await admin.from("payhip_webhook_events").insert({
      id: eventId,
      event_type: type ?? null,
      email: email.trim().toLowerCase(),
    });
    if (evErr && (evErr as { code?: string }).code !== "23505") {
      console.warn("[payhip webhook] idempotency log:", evErr.message);
    }
  }

  revalidatePath("/planner");
  revalidatePath("/settings");
  revalidatePath("/achievements");

  console.info("[payhip webhook] processed", {
    user_id: profile.id,
    new_tier: newTier,
    upgraded,
  });

  return NextResponse.json({
    ok: true,
    user_id: profile.id,
    new_tier: newTier,
    upgraded,
    achievement_awarded: achievementAwarded,
  });
}
