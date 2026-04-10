import { verifyPayhipWebhookSignature } from "@/lib/pricing/payhip-webhook";
import {
  buyerEmailFromPayload,
  payhipEventGrantsAccess,
  payhipEventRevokesAccess,
  setProfileTierByEmail,
  tierFromPayhipProductLink,
  type PayhipWebhookBody,
} from "@/lib/pricing/payhip-sync";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Payhip → TripTiles: verifies `signature`, then updates `profiles.tier` by
 * buyer email. Configure URL in Payhip Settings → Developer.
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` and `PAYHIP_WEBHOOK_SECRET` (Payhip API key).
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

  let body: PayhipWebhookBody;
  try {
    body = (await request.json()) as PayhipWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!verifyPayhipWebhookSignature(body, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const type = body.type;
  const email = buyerEmailFromPayload(body);

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

  const eventId = typeof body.id === "string" ? body.id.trim() : "";
  if (eventId) {
    const { error: insErr } = await admin.from("payhip_webhook_events").insert({
      id: eventId,
      event_type: type ?? null,
      email: email ?? null,
    });
    const code = (insErr as { code?: string } | null)?.code;
    if (code === "23505" || insErr?.message?.includes("duplicate")) {
      return NextResponse.json({ ok: true, duplicate: true, id: eventId });
    }
    if (insErr) {
      console.warn("[payhip webhook] idempotency insert (continuing):", insErr);
    }
  }

  if (payhipEventRevokesAccess(body, type)) {
    if (!email) {
      return NextResponse.json(
        { ok: false, reason: "missing_email_for_refund" },
        { status: 400 },
      );
    }
    const res = await setProfileTierByEmail(admin, email, "free");
    if (!res.ok) {
      console.warn("[payhip webhook] revoke tier failed:", res.error);
      return NextResponse.json({ ok: false, error: res.error }, { status: 200 });
    }
    revalidatePath("/planner");
    console.info("[payhip webhook] tier revoked (free)", { email });
    return NextResponse.json({ ok: true, tier: "free", userId: res.userId });
  }

  if (payhipEventGrantsAccess(type)) {
    if (!email) {
      return NextResponse.json(
        { ok: false, reason: "missing_email" },
        { status: 400 },
      );
    }
    const tier = tierFromPayhipProductLink(body.product_link);
    if (!tier) {
      console.warn("[payhip webhook] unknown product_link", body.product_link);
      return NextResponse.json(
        {
          ok: false,
          reason: "unknown_product",
          product_link: body.product_link ?? null,
        },
        { status: 200 },
      );
    }

    const res = await setProfileTierByEmail(admin, email, tier);
    if (!res.ok) {
      console.warn("[payhip webhook] grant tier failed:", res.error);
      return NextResponse.json({ ok: false, error: res.error }, { status: 200 });
    }
    revalidatePath("/planner");
    revalidatePath("/achievements");
    console.info("[payhip webhook] tier granted", { email, tier });
    return NextResponse.json({ ok: true, tier, userId: res.userId });
  }

  console.info("[payhip webhook] ignored event type", { type, email });
  return NextResponse.json({ ok: true, ignored: true, type: type ?? null });
}
