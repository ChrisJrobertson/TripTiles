import { getStripe } from "@/lib/stripe-server";
import {
  allowedStripePriceIds,
  isNavigatorPriceId,
  stripeCaptainMonthlyPriceId,
  stripeCaptainYearlyPriceId,
  stripeNavigatorMonthlyPriceId,
  stripeNavigatorYearlyPriceId,
  tierFromStripePriceId,
} from "@/lib/stripe-config";
import { getCurrentUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Billing = "monthly" | "yearly";
type PaidTier = "navigator" | "captain";

function resolvePriceId(tier: PaidTier, billing: Billing): string | null {
  if (tier === "navigator") {
    return billing === "yearly"
      ? stripeNavigatorYearlyPriceId() ?? null
      : stripeNavigatorMonthlyPriceId() ?? null;
  }
  return billing === "yearly"
    ? stripeCaptainYearlyPriceId() ?? null
    : stripeCaptainMonthlyPriceId() ?? null;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = (await req.json()) as {
      priceId?: string;
      tier?: PaidTier;
      billing?: Billing;
      successUrl?: string;
      cancelUrl?: string;
    };

    let priceId: string | null = null;
    const rawPrice = typeof body.priceId === "string" ? body.priceId.trim() : "";
    if (rawPrice) {
      const allowed = new Set(allowedStripePriceIds());
      if (!allowed.has(rawPrice)) {
        return NextResponse.json({ error: "Invalid price id." }, { status: 400 });
      }
      priceId = rawPrice;
    } else {
      const tier = body.tier;
      const billing = body.billing ?? "yearly";
      if (tier !== "navigator" && tier !== "captain") {
        return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
      }
      if (billing !== "monthly" && billing !== "yearly") {
        return NextResponse.json(
          { error: "Invalid billing period." },
          { status: 400 },
        );
      }
      priceId = resolvePriceId(tier, billing);
    }

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe prices are not configured on the server." },
        { status: 500 },
      );
    }

    const inferredTier = tierFromStripePriceId(priceId);
    if (!inferredTier) {
      return NextResponse.json({ error: "Unknown price mapping." }, { status: 500 });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      "https://www.triptiles.app";
    const successUrl =
      body.successUrl?.trim() ||
      `${siteUrl}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      body.cancelUrl?.trim() || `${siteUrl}/pricing?cancelled=1`;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          tier: inferredTier,
        },
        ...(isNavigatorPriceId(priceId) ? { trial_period_days: 14 } : {}),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe] create-checkout-session", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Checkout failed." },
      { status: 500 },
    );
  }
}
