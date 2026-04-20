import { getUserTier } from "@/lib/tier";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
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
  const tier = await getUserTier(user.id);
  if (tier === "free") {
    return NextResponse.json(
      { error: "Pro or Family plan required." },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as { name?: string };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Invalid name." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("trip_day_templates")
    .select("id, is_seed")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (row.is_seed) {
    return NextResponse.json(
      { error: "Seed templates cannot be renamed." },
      { status: 403 },
    );
  }

  const { data: updated, error } = await supabase
    .from("trip_day_templates")
    .update({ name })
    .eq("id", id)
    .select("id, name, is_seed, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ template: updated });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const tier = await getUserTier(user.id);
  if (tier === "free") {
    return NextResponse.json(
      { error: "Pro or Family plan required." },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("trip_day_templates")
    .select("id, is_seed")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (row.is_seed) {
    return NextResponse.json({ error: "Seed templates cannot be deleted." }, { status: 400 });
  }

  const { error } = await supabase.from("trip_day_templates").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
