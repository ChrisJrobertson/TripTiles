import { getStripeClient } from "@/lib/stripe/client";
import { arePriceIdsConfigured, configuredPriceIds } from "@/lib/stripe/products";
import { getCurrentUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = (await req.json()) as { priceId?: string };
    const priceId = body.priceId?.trim() ?? "";
    if (!arePriceIdsConfigured()) {
      return NextResponse.json(
        { error: "Stripe price IDs are not configured." },
        { status: 500 },
      );
    }
    const validPriceIds = new Set<string>(configuredPriceIds());
    if (!validPriceIds.has(priceId)) {
      return NextResponse.json({ error: "Invalid price id." }, { status: 400 });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      "https://www.triptiles.app";

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${siteUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing`,
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed." },
      { status: 500 },
    );
  }
}
