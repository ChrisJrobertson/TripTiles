import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Tier } from "@/lib/tier";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function allowDevTierRoute(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEV_TIER_OVERRIDE === "true"
  );
}

function isTier(v: unknown): v is Tier {
  return v === "day_tripper" || v === "navigator" || v === "captain";
}

export async function POST(req: Request) {
  if (!allowDevTierRoute()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await req.json()) as { tier?: unknown };
  if (!isTier(body.tier)) {
    return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
  }
  const tier = body.tier;

  const supabase = await createClient();

  const { error: delErr } = await supabase
    .from("user_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .is("stripe_subscription_id", null);

  if (delErr) {
    console.error("[dev/set-tier] delete", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const { error: insErr } = await supabase.from("user_subscriptions").insert({
    user_id: user.id,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    status: "active",
    tier,
    price_id: "dev_tier_override",
    current_period_end: null,
    payment_status: null,
    grace_until: null,
  });

  if (insErr) {
    console.error("[dev/set-tier] insert", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tier });
}
