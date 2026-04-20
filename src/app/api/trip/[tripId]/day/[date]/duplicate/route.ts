import { eachDateKeyInRange, formatDateISO, parseDate } from "@/lib/date-helpers";
import { getUserTier } from "@/lib/tier";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { userCanEditTrip } from "@/lib/trip-access";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string; date: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { tripId, date: dateParam } = await ctx.params;
  const tier = await getUserTier(user.id);

  const body = (await req.json()) as {
    targets?: string[];
    merge?: "append" | "replace";
    source?: "specific" | "recurring-weekday";
  };
  const merge = body.merge === "append" ? "append" : "replace";
  const source =
    body.source === "recurring-weekday" ? "recurring-weekday" : "specific";

  if (source === "recurring-weekday" && tier === "free") {
    return NextResponse.json(
      { error: "Pro or Family plan required for recurring duplicate." },
      { status: 403 },
    );
  }

  const sourceKey = formatDateISO(parseDate(dateParam.slice(0, 10)));
  const rawTargets = Array.isArray(body.targets) ? body.targets : [];
  const targetKeys = rawTargets.map((t) =>
    formatDateISO(parseDate(String(t).trim().slice(0, 10))),
  );
  const uniqueTargets = [...new Set(targetKeys)].filter((k) => k !== sourceKey);

  if (uniqueTargets.length === 0) {
    return NextResponse.json({ error: "No target dates." }, { status: 400 });
  }

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

  const inRange = new Set(eachDateKeyInRange(trip.start_date, trip.end_date));
  for (const k of [sourceKey, ...uniqueTargets]) {
    if (!inRange.has(k)) {
      return NextResponse.json(
        { error: "Date outside trip." },
        { status: 400 },
      );
    }
  }

  const { error: rpcErr } = await supabase.rpc("duplicate_trip_day", {
    p_trip_id: tripId,
    p_source: sourceKey,
    p_targets: uniqueTargets,
    p_merge: merge,
  });

  if (rpcErr) {
    console.error("[duplicate_trip_day]", rpcErr);
    return NextResponse.json(
      { error: rpcErr.message || "Duplicate failed." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
