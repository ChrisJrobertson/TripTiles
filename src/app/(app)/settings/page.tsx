import { AppNavHeader } from "@/components/app/AppNavHeader";
import { getTierConfig } from "@/lib/tiers";
import { getUserTripCount } from "@/lib/db/trips";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { UserTier } from "@/lib/types";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Settings · TripTiles",
  description: "Account, plan, and billing for TripTiles.",
};

export const dynamic = "force-dynamic";

type PurchaseRow = {
  id: string;
  created_at: string;
  product: string;
  amount_gbp_pence: number;
  currency: string | null;
  metadata: Record<string, unknown> | null;
};

export default async function SettingsPage() {
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    return (
      <main className="min-h-screen bg-cream px-6 py-12">
        <div className="mx-auto max-w-lg rounded-2xl border border-royal/10 bg-white p-8">
          <h1 className="font-serif text-xl font-semibold text-royal">
            Configuration needed
          </h1>
          <p className="mt-3 font-sans text-sm text-royal/70">
            Add Supabase environment variables to{" "}
            <code className="rounded bg-cream px-1">.env.local</code>, then
            restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");

  const supabase = await createClient();
  const [profileRes, purchasesRes, tripCount] = await Promise.all([
    supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("purchases")
      .select(
        "id, created_at, product, amount_gbp_pence, currency, metadata",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getUserTripCount(user.id),
  ]);

  const tier = (profileRes.data?.tier as UserTier) ?? "free";
  const cfg = getTierConfig(tier);
  const purchases = (purchasesRes.data ?? []) as PurchaseRow[];
  const freeMax = getTierConfig("free").features.max_trips ?? 1;

  return (
    <div className="min-h-screen bg-cream pb-16 pt-0">
      <AppNavHeader
        userEmail={user.email ?? ""}
        userTier={tier}
        tripCount={tripCount}
        freeTripLimit={freeMax}
      />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-serif text-3xl font-semibold text-royal">
          Settings
        </h1>

        <section className="mt-10 rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-royal">Billing</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-2xl" aria-hidden>
              {cfg.badge_emoji}
            </span>
            <div>
              <p className="font-sans text-sm font-semibold text-royal">
                Current plan: {cfg.name}
              </p>
              {tier === "free" ? (
                <p className="mt-1 font-sans text-sm text-royal/70">
                  Upgrade to unlock unlimited trips, AI, and custom tiles.
                </p>
              ) : (
                <p className="mt-1 font-sans text-sm text-royal/70">
                  You&apos;re on the {cfg.name} plan. All included features are
                  unlocked.
                </p>
              )}
            </div>
          </div>
          <p className="mt-4 font-sans text-xs text-royal/55">
            One-time payment, no subscription. Your access is permanent.
          </p>
          {tier === "free" ? (
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-gold px-5 py-2.5 font-sans text-sm font-semibold text-royal shadow-sm transition hover:bg-gold/90"
            >
              Upgrade your plan
            </Link>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h3 className="font-serif text-lg font-semibold text-royal">
            Purchase history
          </h3>
          {purchases.length === 0 ? (
            <p className="mt-3 font-sans text-sm text-royal/65">
              No purchases recorded yet. When you buy on Payhip, receipts appear
              here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-royal/10">
              {purchases.map((p) => {
                const receiptUrl =
                  typeof p.metadata?.receipt_url === "string"
                    ? p.metadata.receipt_url
                    : null;
                const amount = (p.amount_gbp_pence / 100).toFixed(2);
                const when = new Date(p.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                return (
                  <li
                    key={p.id}
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-sans text-sm font-medium capitalize text-royal">
                        {p.product}
                      </p>
                      <p className="font-sans text-xs text-royal/60">
                        {when} · £{amount}{" "}
                        {p.currency && p.currency !== "GBP"
                          ? `(${p.currency})`
                          : ""}
                      </p>
                    </div>
                    {receiptUrl ? (
                      <a
                        href={receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans text-sm font-semibold text-royal underline underline-offset-2"
                      >
                        View receipt
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
