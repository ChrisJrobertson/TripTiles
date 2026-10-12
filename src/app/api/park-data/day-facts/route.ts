import { getCurrentLiveWaitsForParks, normaliseLiveWaitParkIds } from "@/lib/live-wait/current";
import type { LiveWaitPublicItem } from "@/lib/live-wait/public-types";
import {
  hoursKindLabel,
  loadResolutionsForParks,
  providerDisplayName,
} from "@/lib/park-data/day-facts";
import type { OperatingWindowResolution } from "@/lib/park-data/schedule";
import { orlandoIdentityByParkId } from "@/lib/park-data/orlando-parks";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function supportedParkIds(ids: string[]): string[] {
  return ids.filter((id) => {
    const row = orlandoIdentityByParkId(id);
    return Boolean(row?.themeParksWikiId || row?.queueTimesId);
  });
}

function waitSummary(items: LiveWaitPublicItem[]) {
  const primary = items.filter((item) => item.provider === "themeparks_wiki");
  const chosen = primary.length > 0 ? primary : items.filter((item) => item.provider === "queue_times");
  if (chosen.length === 0) {
    return {
      count: 0,
      freshness: "NONE" as const,
      providerLabel: null,
      observedAt: null,
    };
  }
  const live = chosen.some((item) => item.freshness === "LIVE");
  const newest = [...chosen].sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at))[0];
  return {
    count: chosen.length,
    freshness: live ? ("LIVE" as const) : ("NOT_CURRENT" as const),
    providerLabel: providerDisplayName(chosen[0]?.provider),
    observedAt: newest?.observed_at ?? null,
  };
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";
  const parkIds = supportedParkIds(
    normaliseLiveWaitParkIds(
      (request.nextUrl.searchParams.get("park_ids") ?? "").split(","),
    ),
  );
  if (!DATE_KEY.test(date) || parkIds.length === 0) {
    return NextResponse.json({ parks: [] });
  }

  let waits: LiveWaitPublicItem[] = [];
  try {
    waits = (await getCurrentLiveWaitsForParks(parkIds)).items;
  } catch {
    waits = [];
  }

  let resolutions = new Map<string, OperatingWindowResolution>();
  try {
    const supabase = await createClient();
    resolutions = await loadResolutionsForParks(supabase, parkIds, date, date);
  } catch {
    resolutions = new Map();
  }

  const parks = parkIds.map((parkId) => {
    const resolution = resolutions.get(`${parkId}|${date}`);
    const identity = orlandoIdentityByParkId(parkId);
    const parkWaits = waits.filter((item) => item.park_id === parkId);
    const closed = resolution?.source === "unknown";
    return {
      parkId,
      parkName: identity?.canonicalName ?? parkId,
      hours: resolution?.open && resolution.close ? `${resolution.open}–${resolution.close}` : null,
      hoursKind: resolution ? hoursKindLabel(resolution.source) : "Unknown",
      hoursDetail: resolution?.label ?? "Hours are not available yet.",
      providerLabel: providerDisplayName(resolution?.provider ?? null),
      fetchedAt: null,
      closed,
      waits: waitSummary(parkWaits),
    };
  });

  return NextResponse.json(
    { parks },
    { headers: { "Cache-Control": "private, max-age=0, s-maxage=45" } },
  );
}
