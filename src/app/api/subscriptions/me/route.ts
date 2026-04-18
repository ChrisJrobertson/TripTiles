import { getUserTier } from "@/lib/tier";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, tier")
      .eq("id", user.id)
      .maybeSingle();

    const productTier = await getUserTier(user.id);

    return NextResponse.json({
      productTier,
      profileTier: profile?.tier ?? "free",
      stripeCustomerId: profile?.stripe_customer_id ?? null,
    });
  } catch (e) {
    console.error("[subscriptions/me]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load subscription." },
      { status: 500 },
    );
  }
}
