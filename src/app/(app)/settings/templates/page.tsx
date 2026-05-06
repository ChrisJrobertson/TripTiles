import { loadSettingsAuthContext } from "@/app/(app)/settings/_lib/settings-auth-context";
import { getUserTier } from "@/lib/tier";
import { TemplatesListClient } from "./TemplatesListClient";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Day templates · Settings · TripTiles",
  description: "Manage saved day templates for your planner.",
};

export const dynamic = "force-dynamic";

export default async function DayTemplatesSettingsPage() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    redirect("/settings/profile");
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings/templates");

  const tier = await getUserTier(user.id);
  if (tier === "free") {
    redirect("/pricing");
  }

  const gate = await loadSettingsAuthContext();
  if (!gate.ok) return gate.panel;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("trip_day_templates")
    .select("id, name, is_seed, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <header>
        <p className="font-sans text-sm text-tt-royal/70">
          <Link
            href="/settings/subscription"
            className="font-semibold text-tt-royal underline underline-offset-2"
          >
            ← Subscription
          </Link>
        </p>
        <h1 className="mt-4 font-heading text-3xl font-semibold text-tt-royal">
          Day templates
        </h1>
        <p className="mt-2 font-sans text-sm text-tt-royal/75">
          Save a day layout from the planner and apply it to other dates. Seed
          templates are included to get you started.
        </p>
      </header>
      <ul className="divide-y divide-tt-line-soft rounded-tt-lg border border-tt-line-soft bg-tt-surface-warm shadow-tt-sm">
        <TemplatesListClient rows={rows ?? []} />
      </ul>
    </>
  );
}
