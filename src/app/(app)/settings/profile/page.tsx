import { loadSettingsAuthContext } from "@/app/(app)/settings/_lib/settings-auth-context";
import { SettingsProfileCard } from "@/components/settings/SettingsProfileCard";
import { SettingsSecurityCard } from "@/components/settings/SettingsSecurityCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile · Settings · TripTiles",
  description: "Your TripTiles profile and security.",
};

export default async function SettingsProfilePage() {
  const loaded = await loadSettingsAuthContext();
  if (!loaded.ok) return loaded.panel;

  const { ctx } = loaded;

  return (
    <>
      <header>
        <h1 className="font-heading text-3xl font-semibold text-tt-royal">
          Profile
        </h1>
        <p className="mt-1 font-sans text-sm text-tt-royal/70">
          Your name and sign-in preferences.
        </p>
      </header>
      <SettingsProfileCard
        email={ctx.user.email ?? ""}
        displayName={ctx.displayName}
        createdAt={ctx.profileCreated}
      />
      <SettingsSecurityCard
        hasPasswordAuth={ctx.hasPasswordAuth}
        oauthProviderLabel={ctx.oauthProviderLabel}
      />
    </>
  );
}
