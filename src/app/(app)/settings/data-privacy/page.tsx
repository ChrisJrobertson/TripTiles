import { loadSettingsAuthContext } from "@/app/(app)/settings/_lib/settings-auth-context";
import { EmailPreferencesSettings } from "@/components/settings/EmailPreferencesSettings";
import { SettingsDataExportCard } from "@/components/settings/SettingsDataExportCard";
import { SettingsDangerZoneCard } from "@/components/settings/SettingsDangerZoneCard";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data & privacy · Settings · TripTiles",
  description: "Export, marketing email preferences, and account deletion.",
};

export default async function SettingsDataPrivacyPage() {
  const loaded = await loadSettingsAuthContext();
  if (!loaded.ok) return loaded.panel;

  const { ctx } = loaded;

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-semibold text-tt-royal">
          Data & privacy
        </h1>
        <p className="mt-1 font-sans text-sm text-tt-royal/70">
          Download your data, control marketing email, or delete your account.
        </p>
      </header>

      <SettingsDataExportCard />

      <Card className="p-6">
        <SectionHeader compact title="Email preferences" />
        <EmailPreferencesSettings initialOptOut={ctx.emailMarketingOptOut} />
      </Card>

      <SettingsDangerZoneCard email={ctx.user.email ?? ""} />
    </>
  );
}
