import {
  resolveProviderUrl,
  type AffiliateLinkOptions,
} from "@/lib/affiliates";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const provider = searchParams.get("provider") as
    | "booking"
    | "getyourguide"
    | "amazon"
    | null;
  const productType = searchParams.get("type") ?? "other";
  const dest = searchParams.get("dest") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const checkIn = searchParams.get("ci") ?? undefined;
  const checkOut = searchParams.get("co") ?? undefined;
  const tileId = searchParams.get("tile") ?? undefined;
  const tripId = searchParams.get("trip") ?? undefined;

  if (
    !provider ||
    !["booking", "getyourguide", "amazon"].includes(provider)
  ) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const targetUrl = resolveProviderUrl({
    provider,
    productType: productType as AffiliateLinkOptions["productType"],
    destinationName: dest,
    searchQuery: q,
    checkIn,
    checkOut,
    tileId,
    tripId,
  });

  const cookieStore = await cookies();
  const headersList = await headers();
  let sessionId = cookieStore.get("tt_sess")?.value;
  const isNewSession = !sessionId;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  let userId: string | null = null;
  try {
    const supabaseUser = await createClient();
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    /* ignore */
  }

  try {
    const admin = createServiceRoleClient();
    void admin.from("affiliate_clicks").insert({
      user_id: userId,
      trip_id: tripId ?? null,
      provider,
      product_type: productType,
      target_url: targetUrl,
      tile_id: tileId ?? null,
      session_id: sessionId,
      referrer: headersList.get("referer") ?? null,
      user_agent: headersList.get("user-agent") ?? null,
      ip_country: null,
    });
  } catch (err) {
    console.error("[affiliate] click log failed:", err);
  }

  const response = NextResponse.redirect(targetUrl, { status: 302 });
  if (isNewSession) {
    response.cookies.set("tt_sess", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
    });
  }
  return response;
}
