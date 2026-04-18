import { formatDateISO, parseDate } from "@/lib/date-helpers";
import { getUserTier } from "@/lib/tier";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { userCanEditTrip } from "@/lib/trip-access";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const tier = await getUserTier(user.id);
  if (tier === "day_tripper") {
    return NextResponse.json(
      { error: "Navigator or Captain required." },
      { status: 403 },
    );
  }

  const { id: templateId } = await ctx.params;
  const body = (await req.json()) as {
    tripId?: string;
    date?: string;
    merge?: "append" | "replace";
  };
  const tripId = typeof body.tripId === "string" ? body.tripId.trim() : "";
  const dateRaw = typeof body.date === "string" ? body.date.trim() : "";
  const merge = body.merge === "append" ? "append" : "replace";
  if (!tripId || !dateRaw) {
    return NextResponse.json(
      { error: "tripId and date required." },
      { status: 400 },
    );
  }

  const dayKey = formatDateISO(parseDate(dateRaw.slice(0, 10)));

  const supabase = await createClient();
  const canEdit = await userCanEditTrip(supabase, user.id, tripId);
  if (!canEdit) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .select("start_date, end_date")
    .eq("id", tripId)
    .maybeSingle();

  if (tripErr || !trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const s = parseDate(`${trip.start_date}T12:00:00`).getTime();
  const e = parseDate(`${trip.end_date}T12:00:00`).getTime();
  const d = parseDate(`${dayKey}T12:00:00`).getTime();
  if (d < s || d > e) {
    return NextResponse.json({ error: "Date outside trip." }, { status: 400 });
  }

  const { error: rpcErr } = await supabase.rpc("apply_day_template", {
    p_template_id: templateId,
    p_trip_id: tripId,
    p_date: dayKey,
    p_merge: merge,
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? "";
    console.error("[apply_day_template]", rpcErr);
    if (msg.includes("template not found")) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    if (msg.includes("trip not found")) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    return NextResponse.json({ error: msg || "Apply failed." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
