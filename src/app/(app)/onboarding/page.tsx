import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { getAllParks } from "@/lib/db/parks";
import { getAllRegions } from "@/lib/db/regions";
import { getUserTrips } from "@/lib/db/trips";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Set up your first TripTiles adventure.",
};

export const dynamic = "force-dynamic";

function firstNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): string {
  const meta = user.user_metadata;
  const full =
    meta && typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (full) return full.split(/\s+/)[0] ?? "";
  const email = user.email?.split("@")[0] ?? "";
  return email.replace(/[.+_].*$/, "") || "";
}

export default async function OnboardingPage() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    redirect("/login?next=/onboarding");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  const trips = await getUserTrips(user.id);
  if (trips.length > 0) redirect("/planner");

  const [regions, parks] = await Promise.all([
    getAllRegions().catch(() => []),
    getAllParks().catch(() => []),
  ]);
  const first = firstNameFromUser(user);

  return (
    <OnboardingWizard firstName={first} regions={regions} parks={parks} />
  );
}
