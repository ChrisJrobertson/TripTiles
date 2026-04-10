import { PlannerClient } from "@/app/(app)/planner/PlannerClient";
import { getAllParks } from "@/lib/db/parks";
import { getActiveTripForUser, getUserTrips } from "@/lib/db/trips";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    return (
      <main className="min-h-screen bg-cream px-6 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-8">
          <h1 className="font-serif text-xl font-semibold text-royal">
            Configuration needed
          </h1>
          <p className="mt-3 font-sans text-sm text-royal/70">
            Add{" "}
            <code className="rounded bg-cream px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and either{" "}
            <code className="rounded bg-cream px-1">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            or{" "}
            <code className="rounded bg-cream px-1">
              NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            </code>{" "}
            to <code className="rounded bg-cream px-1">.env.local</code>, then
            restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/planner");

  const [trips, parks, activeTrip] = await Promise.all([
    getUserTrips(user.id),
    getAllParks(),
    getActiveTripForUser(user.id),
  ]);

  return (
    <PlannerClient
      initialTrips={trips}
      parks={parks}
      initialActiveTripId={activeTrip?.id ?? null}
      userEmail={user.email ?? ""}
    />
  );
}
