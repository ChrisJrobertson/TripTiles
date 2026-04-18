import {
  parseDayTemplatePayload,
  SEED_TEMPLATE_DEFINITIONS,
} from "@/lib/day-template-payload";
import { getUserTier } from "@/lib/tier";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const tier = await getUserTier(user.id);
  if (tier === "day_tripper") {
    return NextResponse.json({ error: "Navigator or Captain required." }, { status: 403 });
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("trip_day_templates")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) === 0) {
    const rows = SEED_TEMPLATE_DEFINITIONS.map((s) => ({
      user_id: user.id,
      name: s.name,
      payload: s.payload,
      is_seed: true,
    }));
    const { error: insErr } = await supabase.from("trip_day_templates").insert(rows);
    if (insErr) {
      console.error("[day-templates] seed insert", insErr);
      return NextResponse.json({ error: "Could not seed templates." }, { status: 500 });
    }
  }

  const { data, error } = await supabase
    .from("trip_day_templates")
    .select("id, name, payload, is_seed, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const tier = await getUserTier(user.id);
  if (tier === "day_tripper") {
    return NextResponse.json({ error: "Navigator or Captain required." }, { status: 403 });
  }

  const body = (await req.json()) as { name?: string; payload?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Invalid name." }, { status: 400 });
  }

  const payload = parseDayTemplatePayload(body.payload);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_day_templates")
    .insert({
      user_id: user.id,
      name,
      payload,
      is_seed: false,
    })
    .select("id, name, payload, is_seed, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ template: data });
}
