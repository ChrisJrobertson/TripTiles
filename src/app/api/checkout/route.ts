import { getStripeClient } from "@/lib/stripe/client";
import { allowedCheckoutPriceIds } from "@/lib/stripe/products";
import { getCurrentUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = (await req.json()) as { priceId?: string };
    const priceId = typeof body.priceId === "string" ? body.priceId.trim() : "";
    const allowed = new Set(allowedCheckoutPriceIds());
    if (!priceId || !allowed.has(priceId)) {
      return NextResponse.json({ error: "Invalid price id." }, { status: 400 });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      "https://www.triptiles.app";

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { user_id: user.id },
      },
      success_url: `${siteUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[checkout]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed." },
      { status: 500 },
    );
  }
}
