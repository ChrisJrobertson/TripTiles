import type { LiveWaitCurrentApiResponse } from "@/lib/live-wait/public-types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_PARKS = 12;

function parseParkIds(sp: URLSearchParams): string[] {
  const raw = sp.get("park_ids") ?? sp.get("parkIds");
  if (!raw?.trim()) return [];
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(ids)].slice(0, MAX_PARKS);
}

export async function GET(request: NextRequest) {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) {
    return NextResponse.json(
      { error: "Server misconfigured", items: [] },
      { status: 503 },
    );
  }

  const parkIds = parseParkIds(request.nextUrl.searchParams);
  if (parkIds.length === 0) {
    const body: LiveWaitCurrentApiResponse = {
      items: [],
      showQueueTimesAttribution: false,
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=0, s-maxage=45" },
    });
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("live_wait_current")
    .select(
      "provider, park_id, attraction_id, external_park_id, external_attraction_id, external_name, wait_minutes, operating_status, is_open, observed_at, fetched_at, stale_after",
    )
    .in("park_id", parkIds)
    .limit(800);

  if (error) {
    return NextResponse.json(
      { error: error.message, items: [] },
      { status: 500 },
    );
  }

  const items = (data ?? []) as LiveWaitCurrentApiResponse["items"];
  const showQueueTimesAttribution = items.some((r) => r.provider === "queue_times");

  const body: LiveWaitCurrentApiResponse = { items, showQueueTimesAttribution };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=0, s-maxage=45" },
  });
}
