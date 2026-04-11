"use server";

import { awardAchievementAction } from "@/actions/achievements";
import { getParksForRegion } from "@/lib/db/parks";
import { getRegionById } from "@/lib/db/regions";
import { getUserCustomTiles } from "@/lib/db/custom-tiles";
import { getCurrentTier } from "@/lib/entitlements";
import { buildAffiliateUrl, hasAnyAffiliatePartner } from "@/lib/affiliates";
import { getTierConfig } from "@/lib/tiers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { CustomTile, Park, Trip } from "@/lib/types";

export async function getPdfExportContextAction(tripId: string): Promise<
  | {
      ok: true;
      trip: Trip;
      parks: Park[];
      customTiles: CustomTile[];
      watermark: boolean;
      design: "standard" | "premium";
      familyName: string;
      bookingLinks: Array<{ label: string; url: string }>;
    }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "NOT_AUTHED" };

  const supabase = await createClient();

  const { data: tripRow, error: tripErr } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .single();

  if (tripErr || !tripRow) return { ok: false, error: "TRIP_NOT_FOUND" };

  const trip = tripRow as Trip;
  const regionId = trip.region_id ?? "orlando";

  const [parks, customTiles, region, tier] = await Promise.all([
    getParksForRegion(regionId),
    getUserCustomTiles(user.id),
    getRegionById(regionId),
    getCurrentTier(),
  ]);

  const config = getTierConfig(tier);
  const destLabel =
    region?.short_name?.trim() ||
    region?.name?.trim() ||
    "Orlando";

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.triptiles.app"
  ).replace(/\/$/, "");

  const bookingLinks: Array<{ label: string; url: string }> =
    hasAnyAffiliatePartner()
      ? [
          {
            label: `Find hotels in ${destLabel}`,
            url: `${siteUrl}${buildAffiliateUrl({
              provider: "booking",
              productType: "hotel",
              destinationName: destLabel,
              checkIn: trip.start_date,
              checkOut: trip.end_date,
              tripId: trip.id,
            })}`,
          },
          {
            label: `Book experiences in ${destLabel}`,
            url: `${siteUrl}${buildAffiliateUrl({
              provider: "getyourguide",
              productType: "experience",
              destinationName: destLabel,
              searchQuery: `${destLabel} tours and tickets`,
              tripId: trip.id,
            })}`,
          },
        ]
      : [];

  return {
    ok: true,
    trip,
    parks,
    customTiles,
    watermark: config.features.pdf_watermark,
    design: config.features.pdf_design,
    familyName: trip.family_name?.trim() || "Your family",
    bookingLinks,
  };
}

export async function awardFirstPdfExportAction(): Promise<
  { ok: true; justEarned: boolean } | { ok: false }
> {
  const r = await awardAchievementAction("first_pdf_export");
  if (!r.ok) return { ok: false };
  return { ok: true, justEarned: r.justEarned };
}
