import { runLiveWaitIngest } from "@/lib/live-wait/ingest-run";
import {
  liveWaitExternalParkIdsFromEnv,
  liveWaitStaleAfterMinutesFromEnv,
} from "@/lib/live-wait/ingest-env";
import { getLiveWaitProviderAdapter } from "@/lib/live-wait/provider-factory";
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
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
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

  const adapter = getLiveWaitProviderAdapter();
  const startedAt = new Date().toISOString();

  const log = await runLiveWaitIngest({
    adapter,
    supabaseUrl: url,
    serviceRoleKey: key,
    externalParkIds: liveWaitExternalParkIdsFromEnv(),
    staleAfterMinutes: liveWaitStaleAfterMinutesFromEnv(),
    dryRun: false,
  });

  const finishedAt = new Date().toISOString();

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt,
    ...log,
  });
}
