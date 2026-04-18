import { mapAttractionRow, mapPriorityRow } from "@/lib/ride-priority-rows";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { userCanEditTrip } from "@/lib/trip-access";
import type { TripRidePriority } from "@/types/attractions";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id: rowId } = await ctx.params;
  const body = (await req.json()) as { newSortOrder?: unknown };
  const newSortOrder =
    typeof body.newSortOrder === "number" && Number.isInteger(body.newSortOrder)
      ? body.newSortOrder
      : null;
  if (newSortOrder == null || newSortOrder < 0) {
    return NextResponse.json(
      { error: "newSortOrder must be a non-negative integer." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: row, error: rowErr } = await supabase
    .from("trip_ride_priorities")
    .select("id, trip_id, day_date, priority")
    .eq("id", rowId)
    .maybeSingle();

  if (rowErr || !row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const canEdit = await userCanEditTrip(supabase, user.id, row.trip_id);
  if (!canEdit) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }

  const { count, error: cntErr } = await supabase
    .from("trip_ride_priorities")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", row.trip_id)
    .eq("day_date", row.day_date)
    .eq("priority", row.priority);

  if (cntErr) {
    return NextResponse.json({ error: cntErr.message }, { status: 500 });
  }
  const maxIdx = Math.max(0, (count ?? 1) - 1);
  if (newSortOrder > maxIdx) {
    return NextResponse.json(
      { error: "newSortOrder out of range." },
      { status: 400 },
    );
  }

  const { error: rpcErr } = await supabase.rpc("reorder_ride_priority", {
    p_id: rowId,
    p_new_sort_order: newSortOrder,
  });

  if (rpcErr) {
    console.error("[reorder_ride_priority]", rpcErr);
    const msg = rpcErr.message ?? "";
    if (msg.includes("row not found")) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (msg.includes("not authorised")) {
      return NextResponse.json({ error: "Not authorised." }, { status: 403 });
    }
    return NextResponse.json({ error: msg || "Reorder failed." }, { status: 400 });
  }

  const { data: group, error: fetchErr } = await supabase
    .from("trip_ride_priorities")
    .select("*, attractions (*)")
    .eq("trip_id", row.trip_id)
    .eq("day_date", row.day_date)
    .eq("priority", row.priority)
    .order("sort_order", { ascending: true });

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const priorities: TripRidePriority[] = (group ?? []).map((raw) => {
    const rec = raw as Record<string, unknown>;
    const rawAttr = rec.attractions as Record<string, unknown> | null;
    const attraction = rawAttr ? mapAttractionRow(rawAttr) : undefined;
    return mapPriorityRow(rec, attraction);
  });

  return NextResponse.json({ priorities });
}
