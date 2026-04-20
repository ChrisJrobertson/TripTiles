import { getStripeClient } from "@/lib/stripe/client";
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
    const { data: row, error } = await supabase
      .from("purchases")
      .select("provider_customer_id, created_at")
      .eq("user_id", user.id)
      .eq("provider", "stripe")
      .not("provider_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !row?.provider_customer_id?.trim()) {
      return NextResponse.json(
        { error: "No billing account on file yet." },
        { status: 404 },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      "https://www.triptiles.app";

    const stripe = getStripeClient();
    const portal = await stripe.billingPortal.sessions.create({
      customer: row.provider_customer_id.trim(),
      return_url: `${siteUrl}/settings`,
    });

    if (!portal.url) {
      return NextResponse.json(
        { error: "Stripe did not return a portal URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: portal.url });
  } catch (e) {
    console.error("[customer-portal]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Portal session failed." },
      { status: 500 },
    );
  }
}
