import { parseDayTemplatePayload } from "@/lib/day-template-payload";
import { formatDateISO, formatDateKey, parseDate } from "@/lib/date-helpers";
import { getParkIdFromSlotValue } from "@/lib/assignment-slots";
import { getUserTier } from "@/lib/tier";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { Assignments } from "@/lib/types";

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
    return NextResponse.json({ error: "Navigator or Captain required." }, { status: 403 });
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
    return NextResponse.json({ error: "tripId and date required." }, { status: 400 });
  }
  const dateKey = formatDateKey(parseDate(dateRaw.slice(0, 10)));
  const daySql = formatDateISO(parseDate(dateKey));

  const supabase = await createClient();
  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .select("id, owner_id, start_date, end_date, assignments, preferences")
    .eq("id", tripId)
    .maybeSingle();

  if (tripErr || !trip || trip.owner_id !== user.id) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const s = parseDate(`${trip.start_date}T12:00:00`).getTime();
  const e = parseDate(`${trip.end_date}T12:00:00`).getTime();
  const d = parseDate(`${dateKey}T12:00:00`).getTime();
  if (d < s || d > e) {
    return NextResponse.json({ error: "Date outside trip." }, { status: 400 });
  }

  const { data: tpl, error: tplErr } = await supabase
    .from("trip_day_templates")
    .select("payload")
    .eq("id", templateId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (tplErr || !tpl?.payload) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const payload = parseDayTemplatePayload(tpl.payload);
  if (!payload) {
    return NextResponse.json({ error: "Invalid template." }, { status: 400 });
  }

  const assignments = { ...(trip.assignments as Assignments) };
  const prefs =
    trip.preferences && typeof trip.preferences === "object" && !Array.isArray(trip.preferences)
      ? { ...trip.preferences }
      : {};
  const dayNotesRaw = prefs.day_notes;
  const dayNotes =
    dayNotesRaw && typeof dayNotesRaw === "object" && !Array.isArray(dayNotesRaw)
      ? { ...(dayNotesRaw as Record<string, string>) }
      : {};

  if (merge === "replace") {
    delete assignments[dateKey];
    delete dayNotes[dateKey];
    const { error: delErr } = await supabase
      .from("trip_ride_priorities")
      .delete()
      .eq("trip_id", tripId)
      .eq("day_date", daySql);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }
  }

  const curDay = assignments[dateKey] ?? {};
  const nextDay =
    merge === "replace"
      ? { ...payload.assignments }
      : {
          ...curDay,
          ...Object.fromEntries(
            Object.entries(payload.assignments).filter(([slot]) => {
              const st = slot as keyof typeof curDay;
              const existing = curDay[st];
              const exId = getParkIdFromSlotValue(existing);
              return exId == null || exId === "";
            }),
          ),
        };
  assignments[dateKey] = nextDay;

  if (payload.dayNote != null) {
    dayNotes[dateKey] = payload.dayNote;
  }
  prefs.day_notes = dayNotes;

  const { error: upTripErr } = await supabase
    .from("trips")
    .update({
      assignments,
      preferences: prefs,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tripId);

  if (upTripErr) {
    return NextResponse.json({ error: upTripErr.message }, { status: 500 });
  }

  const inserts: Array<Record<string, unknown>> = [];
  let sortBase = 0;
  if (merge === "append") {
    const { data: maxRow } = await supabase
      .from("trip_ride_priorities")
      .select("sort_order")
      .eq("trip_id", tripId)
      .eq("day_date", daySql)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortBase = Number(maxRow?.sort_order ?? -1) + 1;
  }

  let offset = 0;
  for (const row of payload.ridePriorities) {
    if (!row.attractionId) continue;
    inserts.push({
      trip_id: tripId,
      attraction_id: row.attractionId,
      day_date: daySql,
      priority: row.priority,
      sort_order: sortBase + offset,
      notes: row.notes ?? null,
    });
    offset += 1;
  }
  if (inserts.length > 0) {
    const { error: insErr } = await supabase.from("trip_ride_priorities").insert(inserts);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
