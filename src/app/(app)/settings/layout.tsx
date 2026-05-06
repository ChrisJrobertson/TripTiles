import { AppNavHeader } from "@/components/app/AppNavHeader";
import { formatProductTierName } from "@/lib/product-tier-labels";
import { loadSettingsAuthContext } from "@/app/(app)/settings/_lib/settings-auth-context";
import type { Metadata } from "next";
import { SettingsSidebar } from "@/app/(app)/settings/SettingsSidebar";

export const metadata: Metadata = {
  title: "Settings · TripTiles",
  description: "Account, plan, and billing for TripTiles.",
};

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loaded = await loadSettingsAuthContext();
  if (!loaded.ok) return <>{loaded.panel}</>;

  const { ctx } = loaded;
  const showTemplates = ctx.productTier !== "free";

  return (
    <div className="min-h-screen bg-transparent pb-16 pt-0">
      <AppNavHeader
        userEmail={ctx.user.email ?? ""}
        userTier={ctx.navTier}
        tripCount={ctx.tripCount}
        freeTripLimit={ctx.freeMax}
        planBadgeLabel={formatProductTierName(ctx.productTier)}
        showUpgradeNavCta={ctx.productTier === "free"}
        stripeCustomerId={ctx.profileRow.stripe_customer_id ?? null}
      />
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 md:flex-row md:items-start">
        <SettingsSidebar showTemplates={showTemplates} />
        <div className="min-w-0 flex-1 space-y-8">{children}</div>
      </main>
    </div>
  );
}
