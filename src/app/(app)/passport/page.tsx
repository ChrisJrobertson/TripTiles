import { AppNavHeader } from "@/components/app/AppNavHeader";
import { ProfileLoadErrorPanel } from "@/components/app/ProfileLoadErrorPanel";
import { Card } from "@/components/ui/Card";
import {
  getAchievementDefinitions,
  getUserAchievements,
} from "@/lib/db/achievements";
import { getParksByIds } from "@/lib/db/parks";
import { getUserTrips, getUserTripCount } from "@/lib/db/trips";
import { formatProductTierName } from "@/lib/product-tier-labels";
import {
  collectParkIdsFromTrips,
  deriveTripStatus,
  passportStatusLabel,
  utcTodayYMD,
} from "@/lib/passport-helpers";
import { getPublicAdventureTitle } from "@/lib/public-trip-display";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { readProfileRow, tierFromProfileRow } from "@/lib/supabase/profile-read";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/tier";
import { getTierConfig } from "@/lib/tiers";
import type { Achievement, AchievementDefinition } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Passport · TripTiles",
  description:
    "Your trips, stamps, clones earned, and recent achievements.",
};

export const dynamic = "force-dynamic";

function achievementTitle(
  defByKey: Map<string, AchievementDefinition>,
  row: Achievement,
): string {
  const d = row.achievement_key
    ? defByKey.get(String(row.achievement_key))
    : undefined;
  if (d?.title) return d.title;
  if (row.achievement_key) return String(row.achievement_key).replace(/_/g, " ");
  return "Achievement";
}

export default async function PassportPage() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    return (
      <main className="min-h-screen px-6 py-12">
        <Card className="mx-auto max-w-lg p-8">
          <h1 className="font-heading text-xl font-semibold text-tt-royal">
            Configuration needed
          </h1>
          <p className="mt-3 font-sans text-sm text-tt-royal/70">
            Add Supabase environment variables to{" "}
            <code className="rounded-tt-md bg-tt-surface-warm px-1 font-meta text-xs">
              .env.local
            </code>
            .
          </p>
        </Card>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/passport");

  const supabase = await createClient();
  const [tripsRaw, definitions, earned, profileRead, tripCount, productTier] =
    await Promise.all([
      getUserTrips(user.id),
      getAchievementDefinitions(),
      getUserAchievements(user.id),
      readProfileRow<{ tier: string }>(supabase, user.id, "tier"),
      getUserTripCount(user.id),
      getUserTier(user.id),
    ]);

  if (!profileRead.ok) {
    return <ProfileLoadErrorPanel detail={profileRead.message} />;
  }

  const navTier = tierFromProfileRow(profileRead.data);
  const freeMax = getTierConfig("free").features.max_trips ?? 1;

  const today = utcTodayYMD();
  const trips = [...tripsRaw].sort((a, b) =>
    b.start_date.localeCompare(a.start_date),
  );
  const clonesEarned = trips.reduce((s, t) => s + (t.clone_count ?? 0), 0);
  const parkIds = [...collectParkIdsFromTrips(trips)];
  const parks = await getParksByIds(parkIds).catch(() => []);
  const parkById = new Map(parks.map((p) => [p.id, p]));

  const defByKey = new Map(definitions.map((d) => [d.key, d]));
  const recentAchievements = earned.slice(0, 6);

  return (
    <div className="min-h-screen bg-transparent pb-16 pt-0">
      <AppNavHeader
        userEmail={user.email ?? ""}
        userTier={navTier}
        tripCount={tripCount}
        freeTripLimit={freeMax}
        planBadgeLabel={formatProductTierName(productTier)}
        showUpgradeNavCta={productTier === "free"}
      />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        <header>
          <h1 className="font-heading text-3xl font-semibold text-tt-royal">
            Passport
          </h1>
          <p className="mt-2 font-sans text-sm text-tt-royal/75">
            Your planning snapshot — open the full trophy room anytime.
          </p>
          <p className="mt-4 font-sans text-sm">
            <Link
              href="/achievements"
              className="font-semibold text-tt-royal underline underline-offset-2"
            >
              View all achievements
            </Link>
          </p>
        </header>

        <section aria-labelledby="passport-stats">
          <h2 id="passport-stats" className="sr-only">
            Stats
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Trips in planner"
              value={String(trips.length)}
              hint={null}
            />
            <StatCard
              label="Clones earned"
              value={String(clonesEarned)}
              hint="Total clones across your published trips."
            />
            <StatCard
              label="Parks logged on your calendar"
              value={String(parkIds.length)}
              hint="Distinct parks assigned on your trip days."
            />
            <StatCard
              label="Profile: parks visited"
              value="—"
              hint="Coming soon — we’ll surface this when counts are consistently maintained."
            />
            <StatCard
              label="Profile: AI generations (lifetime)"
              value="—"
              hint="Coming soon — synced totals will appear here."
            />
            <StatCard
              label="Profile: templates cloned"
              value="—"
              hint="Coming soon — template clone totals will appear here."
            />
          </div>
        </section>

        <section aria-labelledby="passport-trips">
          <h2
            id="passport-trips"
            className="font-heading text-xl font-semibold text-tt-royal"
          >
            Trips
          </h2>
          {trips.length === 0 ? (
            <p className="mt-3 font-sans text-sm text-tt-royal/70">
              No trips yet — start one from the planner.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {trips.map((trip) => {
                const status = deriveTripStatus(
                  today,
                  trip.start_date,
                  trip.end_date,
                );
                return (
                  <li key={trip.id}>
                    <Link
                      href={`/trip/${trip.id}`}
                      className="block rounded-tt-lg border border-tt-line-soft bg-tt-surface-warm p-4 shadow-tt-sm transition hover:border-tt-gold/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-heading text-base font-semibold text-tt-royal">
                          {getPublicAdventureTitle(trip)}
                        </p>
                        <span className="shrink-0 rounded-full bg-tt-royal/10 px-2.5 py-0.5 font-meta text-[10px] font-semibold uppercase tracking-wide text-tt-royal">
                          {passportStatusLabel(status)}
                        </span>
                      </div>
                      <p className="mt-1 font-sans text-xs text-tt-royal/60">
                        {trip.start_date} → {trip.end_date}
                      </p>
                      {trip.is_public && trip.public_slug ? (
                        <p className="mt-2 font-sans text-xs text-tt-royal/55">
                          Public · {trip.clone_count ?? 0} clones
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="passport-stamps">
          <h2
            id="passport-stamps"
            className="font-heading text-xl font-semibold text-tt-royal"
          >
            Stamps from your plans
          </h2>
          {parkIds.length === 0 ? (
            <p className="mt-3 font-sans text-sm text-tt-royal/70">
              Assign parks on your itinerary days to build your stamp collection.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {parkIds.map((id) => {
                const park = parkById.get(id);
                const iconRaw = park?.icon?.trim() ?? "";
                const showImg =
                  iconRaw.startsWith("http") || iconRaw.startsWith("/");

                return (
                  <li
                    key={id}
                    className="flex items-center gap-3 rounded-tt-lg border border-tt-line-soft bg-white/90 px-4 py-3 shadow-tt-sm"
                  >
                    {showImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={iconRaw}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
                        style={{
                          background: park?.bg_colour ?? "#333",
                          color: park?.fg_colour ?? "#fff",
                        }}
                        aria-hidden
                      >
                        {iconRaw || "🎢"}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-sans text-sm font-semibold text-tt-royal">
                        {park?.name ?? `Park ${id}`}
                      </p>
                      {park?.park_group ? (
                        <p className="truncate font-sans text-xs text-tt-royal/60">
                          {park.park_group}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="passport-achievements">
          <h2
            id="passport-achievements"
            className="font-heading text-xl font-semibold text-tt-royal"
          >
            Recent achievements
          </h2>
          {recentAchievements.length === 0 ? (
            <p className="mt-3 font-sans text-sm text-tt-royal/70">
              Complete trips and milestones to earn your first badges.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentAchievements.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-tt-lg border border-tt-line-soft bg-tt-surface/95 px-4 py-3"
                >
                  <p className="font-sans text-sm font-medium text-tt-royal">
                    {achievementTitle(defByKey, row)}
                  </p>
                  <time
                    dateTime={row.earned_at}
                    className="shrink-0 font-meta text-[10px] uppercase tracking-wide text-tt-royal/55"
                  >
                    {new Date(row.earned_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string | null;
}) {
  return (
    <div className="rounded-tt-lg border border-tt-line-soft bg-white/90 px-4 py-3 shadow-tt-sm">
      <p className="font-meta text-[10px] font-semibold uppercase tracking-wide text-tt-royal/55">
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl font-semibold text-tt-royal">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 font-sans text-[11px] leading-snug text-tt-royal/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
