import { getStripe } from "@/lib/stripe-server";
import { upsertUserSubscriptionFromStripe } from "@/lib/stripe-subscription-db";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr || !profile?.stripe_customer_id?.trim()) {
      return NextResponse.json(
        { ok: false, error: "No Stripe customer linked yet." },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const subs = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id.trim(),
      status: "all",
      limit: 20,
    });

    const active = subs.data.find((s) =>
      ["active", "trialing", "past_due"].includes(s.status),
    );

    const admin = createServiceRoleClient();
    if (active) {
      await upsertUserSubscriptionFromStripe(admin, {
        userId: user.id,
        stripeCustomerId: profile.stripe_customer_id.trim(),
        subscription: active,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[subscriptions/refresh]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Refresh failed." },
      { status: 500 },
    );
  }
}
