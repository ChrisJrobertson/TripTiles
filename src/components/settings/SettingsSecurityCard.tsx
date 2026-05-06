"use client";

import { changePasswordAction } from "@/actions/account";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Props = {
  hasPasswordAuth: boolean;
  oauthProviderLabel?: string | null;
};

export function SettingsSecurityCard({
  hasPasswordAuth,
  oauthProviderLabel = null,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const changePw = useCallback(() => {
    setPwMsg(null);
    if (newPw !== confPw) {
      setPwMsg("New passwords do not match.");
      return;
    }
    startTransition(async () => {
      const r = await changePasswordAction({
        currentPassword: curPw,
        newPassword: newPw,
      });
      if (!r.ok) {
        setPwMsg(r.error);
        return;
      }
      setCurPw("");
      setNewPw("");
      setConfPw("");
      setPwMsg("Password updated.");
    });
  }, [curPw, newPw, confPw]);

  const signOutEverywhere = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "global" });
    router.push("/");
    router.refresh();
  }, [router]);

  if (hasPasswordAuth) {
    return (
      <Card className="p-6">
        <SectionHeader compact title="Security" />
        <p className="mt-2 font-sans text-sm text-tt-royal/70">
          Change the password you use with email sign-in.
        </p>
        <div className="mt-4 space-y-3">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            className="w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 font-sans text-sm shadow-tt-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (8+ characters)"
            className="w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 font-sans text-sm shadow-tt-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            className="w-full rounded-tt-md border border-tt-line bg-tt-surface px-3 py-2 font-sans text-sm shadow-tt-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tt-royal"
            value={confPw}
            onChange={(e) => setConfPw(e.target.value)}
          />
          <Button
            type="button"
            disabled={pending}
            variant="primary"
            onClick={() => void changePw()}
          >
            Update password
          </Button>
          {pwMsg ? (
            <p className="font-sans text-sm text-tt-royal/80">{pwMsg}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void signOutEverywhere()}
          className="mt-6 font-sans text-sm font-semibold text-tt-royal underline underline-offset-4 decoration-tt-gold/40 hover:text-tt-royal/85"
        >
          Sign out everywhere
        </button>
      </Card>
    );
  }

  if (oauthProviderLabel) {
    return (
      <Card className="p-6">
        <SectionHeader compact title="Security" />
        <p className="mt-2 font-sans text-sm text-tt-royal/70">
          {oauthProviderLabel === "Apple" ? (
            <>
              Your account uses Sign in with Apple. Password management is
              handled by Apple.
            </>
          ) : (
            <>
              Your account uses {oauthProviderLabel} to sign in. Password
              management is handled in your {oauthProviderLabel} account
              settings.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => void signOutEverywhere()}
          className="mt-4 font-sans text-sm font-semibold text-tt-royal underline underline-offset-4 decoration-tt-gold/40 hover:text-tt-royal/85"
        >
          Sign out everywhere
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <SectionHeader compact title="Security" />
      <p className="mt-2 font-sans text-sm text-tt-royal/70">
        You signed in with an email code. To set a permanent password, use the
        password reset flow.
      </p>
      <button
        type="button"
        onClick={() => void signOutEverywhere()}
        className="mt-4 font-sans text-sm font-semibold text-tt-royal underline underline-offset-4 decoration-tt-gold/40 hover:text-tt-royal/85"
      >
        Sign out everywhere
      </button>
    </Card>
  );
}
