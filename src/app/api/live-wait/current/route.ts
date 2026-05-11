import type { LiveWaitCurrentApiResponse } from "@/lib/live-wait/public-types";
import {
  getCurrentLiveWaitsForParks,
  LIVE_WAIT_CURRENT_CACHE_CONTROL,
  normaliseLiveWaitParkIds,
} from "@/lib/live-wait/current";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseParkIds(sp: URLSearchParams): string[] {
  const raw = sp.get("park_ids") ?? sp.get("parkIds");
  if (!raw?.trim()) return [];
  return normaliseLiveWaitParkIds(raw.split(","));
}

export async function GET(request: NextRequest) {
  const parkIds = parseParkIds(request.nextUrl.searchParams);
  if (parkIds.length === 0) {
    const body: LiveWaitCurrentApiResponse = {
      items: [],
      showQueueTimesAttribution: false,
    };
    return NextResponse.json(body, {
      headers: { "Cache-Control": LIVE_WAIT_CURRENT_CACHE_CONTROL },
    });
  }

  try {
    const body = await getCurrentLiveWaitsForParks(parkIds);
    return NextResponse.json(body, {
      headers: { "Cache-Control": LIVE_WAIT_CURRENT_CACHE_CONTROL },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Live wait read failed",
        items: [],
        showQueueTimesAttribution: false,
      },
      { status: 500, headers: { "Cache-Control": LIVE_WAIT_CURRENT_CACHE_CONTROL } },
    );
  }
}
