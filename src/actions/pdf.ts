"use server";

import { awardAchievementAction } from "@/actions/achievements";
import { getParksForRegion } from "@/lib/db/parks";
import { getRegionById } from "@/lib/db/regions";
import { getUserCustomTiles } from "@/lib/db/custom-tiles";
import { mapTripRow } from "@/lib/db/trips";
import { getCurrentTier } from "@/lib/entitlements";
import { isTierLoadFailure } from "@/lib/supabase/tier-load-error";
import { buildAffiliateUrl, hasAnyAffiliatePartner } from "@/lib/affiliates";
import { getTierConfig } from "@/lib/tiers";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type {
  BudgetCategory,
  ChecklistCategory,
  CustomTile,
  Park,
  TemperatureUnit,
  Trip,
  TripBudgetItem,
  TripChecklistItem,
} from "@/lib/types";
import type { PaymentCurrency, TripPayment } from "@/types/payments";

function mapBudgetRow(r: Record<string, unknown>): TripBudgetItem {
  return {
    id: String(r.id),
    trip_id: String(r.trip_id),
    category: r.category as BudgetCategory,
    label: String(r.label ?? ""),
    amount: Number(r.amount ?? 0),
    currency: String(r.currency ?? "GBP"),
    is_paid: Boolean(r.is_paid),
    notes: r.notes != null ? String(r.notes) : null,
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

function mapPaymentRow(r: Record<string, unknown>): TripPayment {
  return {
    id: String(r.id),
    trip_id: String(r.trip_id),
    label: String(r.label ?? ""),
    amount_pence: Number(r.amount_pence ?? 0),
    currency: (r.currency === "USD" ? "USD" : "GBP") as PaymentCurrency,
    booking_date: r.booking_date != null ? String(r.booking_date) : null,
    due_date: r.due_date != null ? String(r.due_date) : null,
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

function mapChecklistRow(r: Record<string, unknown>): TripChecklistItem {
  return {
    id: String(r.id),
    trip_id: String(r.trip_id),
    category: r.category as ChecklistCategory,
    label: String(r.label ?? ""),
    is_checked: Boolean(r.is_checked),
    is_custom: Boolean(r.is_custom),
    sort_order: Number(r.sort_order ?? 0),
    created_at: String(r.created_at ?? ""),
  };
}

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
      budgetItems: TripBudgetItem[];
      checklistItems: TripChecklistItem[];
      tripPayments: TripPayment[];
      temperatureUnit: TemperatureUnit;
    }
  | { ok: false; error: string }
> {
  try {
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

  const trip = mapTripRow(tripRow as Record<string, unknown>);
  const regionId = trip.region_id ?? "orlando";

  const [
    parks,
    customTiles,
    region,
    tier,
    budgetRes,
    checklistRes,
    paymentsRes,
    profileRes,
  ] = await Promise.all([
    getParksForRegion(regionId),
    getUserCustomTiles(user.id),
    getRegionById(regionId),
    getCurrentTier(),
    supabase
      .from("trip_budget_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("trip_checklist_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("trip_payments")
      .select("*")
      .eq("trip_id", tripId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("profiles")
      .select("temperature_unit")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const budgetItems = (budgetRes.data ?? []).map((x) =>
    mapBudgetRow(x as Record<string, unknown>),
  );
  const checklistItems = (checklistRes.data ?? []).map((x) =>
    mapChecklistRow(x as Record<string, unknown>),
  );
  const tripPayments = (paymentsRes.data ?? []).map((x) =>
    mapPaymentRow(x as Record<string, unknown>),
  );

  const temperatureUnit: TemperatureUnit =
    profileRes.data &&
    typeof profileRes.data === "object" &&
    "temperature_unit" in profileRes.data &&
    (profileRes.data as { temperature_unit?: string }).temperature_unit ===
      "f"
      ? "f"
      : "c";

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
    budgetItems,
    checklistItems,
    tripPayments,
    temperatureUnit,
  };
  } catch (e) {
    if (isTierLoadFailure(e)) {
      return { ok: false, error: "PROFILE_TIER_UNAVAILABLE" };
    }
    throw e;
  }
}

export async function awardFirstPdfExportAction(): Promise<
  { ok: true; justEarned: boolean } | { ok: false }
> {
  const r = await awardAchievementAction("first_pdf_export");
  if (!r.ok) return { ok: false };
  return { ok: true, justEarned: r.justEarned };
}
