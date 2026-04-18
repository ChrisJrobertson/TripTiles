import { getStripe } from "@/lib/stripe-server";
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
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !row?.stripe_customer_id?.trim()) {
      return NextResponse.json(
        { error: "No Stripe customer on file yet." },
        { status: 400 },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      "https://www.triptiles.app";

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id.trim(),
      return_url: `${siteUrl}/planner`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a portal URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe] create-portal-session", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Portal session failed." },
      { status: 500 },
    );
  }
}
