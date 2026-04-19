import { getStripeClient } from "@/lib/stripe/client";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("provider_customer_id")
    .eq("user_id", user.id)
    .eq("provider", "stripe")
    .not("provider_customer_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customerId =
    data?.provider_customer_id && String(data.provider_customer_id).trim()
      ? String(data.provider_customer_id).trim()
      : null;

  if (!customerId) {
    return NextResponse.json(
      {
        error:
          "No Stripe subscription found for this account yet. Complete checkout first.",
      },
      { status: 404 },
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://www.triptiles.app";

  const stripe = getStripeClient();
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/settings`,
  });

  return NextResponse.json({ url: portal.url });
}
