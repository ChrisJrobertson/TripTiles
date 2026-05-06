import { loadSettingsAuthContext } from "@/app/(app)/settings/_lib/settings-auth-context";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TemperatureUnitSettings } from "@/components/settings/TemperatureUnitSettings";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications · Settings · TripTiles",
  description: "Planner display preferences.",
};

export default async function SettingsNotificationsPage() {
  const loaded = await loadSettingsAuthContext();
  if (!loaded.ok) return loaded.panel;

  const { ctx } = loaded;

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-semibold text-tt-royal">
          Notifications
        </h1>
        <p className="mt-1 font-sans text-sm text-tt-royal/70">
          How the planner shows temperature and related display details.
        </p>
      </header>
      <Card className="p-6">
        <SectionHeader compact title="Planner display" />
        <TemperatureUnitSettings initial={ctx.initialTemperatureUnit} />
      </Card>
    </>
  );
}
