import { isCronAuthorized } from "@/lib/cron/authorize";
import { runThemeParkIngest } from "@/lib/park-data/orchestrate-ingest";
import { getSupabaseUrl } from "@/lib/supabase/env";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return unauthorized();
  }

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 },
    );
  }

  const report = await runThemeParkIngest({
    supabaseUrl: url,
    serviceRoleKey: key,
    dryRun: false,
  });

  return NextResponse.json({
    ok: true,
    ...report,
  });
}
