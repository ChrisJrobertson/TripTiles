import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function allowDevTierRoute(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEV_TIER_OVERRIDE === "true"
  );
}

function isRetailTier(v: unknown): v is "free" | "pro" | "family" {
  return v === "free" || v === "pro" || v === "family";
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
  if (!isRetailTier(body.tier)) {
    return NextResponse.json({ error: "Invalid tier." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      tier: body.tier,
      tier_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[dev/set-profile-tier]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tier: body.tier });
}
