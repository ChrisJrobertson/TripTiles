import { AppNavHeader } from "@/components/app/AppNavHeader";
import { TemplatesListClient } from "./TemplatesListClient";
import { getUserTripCount } from "@/lib/db/trips";
import { getTierConfig } from "@/lib/tiers";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import {
  readProfileRow,
  tierFromProfileRow,
} from "@/lib/supabase/profile-read";
import { formatProductTierName, getUserTier } from "@/lib/tier";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Day templates · TripTiles",
  description: "Manage saved day templates for your planner.",
};

export const dynamic = "force-dynamic";

export default async function DayTemplatesSettingsPage() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    redirect("/settings");
  }
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings/templates");

  const tier = await getUserTier(user.id);
  if (tier === "free") {
    redirect("/pricing");
  }

  const supabase = await createClient();
  const profileRead = await readProfileRow<{ tier: string }>(
    supabase,
    user.id,
    "tier",
  );
  const legacyTier = profileRead.ok ? tierFromProfileRow(profileRead.data) : "free";
  const tripCount = await getUserTripCount(user.id);
  const freeMax = getTierConfig("free").features.max_trips ?? 1;
  const { data: rows } = await supabase
    .from("trip_day_templates")
    .select("id, name, is_seed, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-cream pb-24">
      <AppNavHeader
        userEmail={user.email ?? ""}
        userTier={legacyTier}
        tripCount={tripCount}
        freeTripLimit={freeMax}
        planBadgeLabel={formatProductTierName(tier)}
      />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="font-sans text-sm text-royal/60">
          <Link href="/settings" className="text-royal underline underline-offset-2">
            ← Settings
          </Link>
        </p>
        <h1 className="mt-4 font-serif text-2xl font-semibold text-royal">
          Day templates
        </h1>
        <p className="mt-2 font-sans text-sm text-royal/75">
          Save a day layout from the planner and apply it to other dates. Seed
          templates are included to get you started.
        </p>
        <ul className="mt-8 divide-y divide-royal/10 rounded-xl border border-royal/10 bg-white">
          <TemplatesListClient rows={rows ?? []} />
        </ul>
      </main>
    </div>
  );
}
