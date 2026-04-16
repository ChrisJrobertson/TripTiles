"use client";

import {
  changePasswordAction,
  deleteAccountAction,
  exportUserDataAction,
  updateDisplayNameAction,
} from "@/actions/account";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Props = {
  email: string;
  displayName: string | null;
  createdAt: string | null;
  tierLabel: string;
  tierBadge: string;
  hasPasswordAuth: boolean;
  /** When set, user signed in with OAuth only (e.g. Apple) — no password to change here. */
  oauthProviderLabel?: string | null;
};

export function SettingsAccountPanel({
  email,
  displayName: initialName,
  createdAt,
  tierLabel,
  tierBadge,
  hasPasswordAuth,
  oauthProviderLabel = null,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delEmail, setDelEmail] = useState("");
  const [delErr, setDelErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const saveName = useCallback(() => {
    setMsg(null);
    startTransition(async () => {
      const r = await updateDisplayNameAction({ displayName: name });
      if (!r.ok) {
        setMsg(r.error);
        return;
      }
      setDirty(false);
      setMsg("Saved.");
      router.refresh();
    });
  }, [name, router]);

  const downloadExport = useCallback(async () => {
    setExporting(true);
    setMsg(null);
    const r = await exportUserDataAction();
    setExporting(false);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    const blob = new Blob([r.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

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

  const confirmDelete = useCallback(() => {
    setDelErr(null);
    startTransition(async () => {
      const r = await deleteAccountAction({ confirmationEmail: delEmail });
      if (r && "ok" in r && r.ok === false) {
        setDelErr(r.error);
      }
    });
  }, [delEmail]);

  const created =
    createdAt &&
    new Date(createdAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold text-royal">Profile</h2>
        <div className="mt-4 space-y-4 font-sans text-sm">
          <label className="block text-royal">
            Display name
            <input
              className="mt-1 w-full rounded-lg border-2 border-royal/20 px-3 py-2"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <p className="text-royal/70">
            <span className="font-medium text-royal">Email</span>{" "}
            <span className="select-all">{email}</span> (read-only)
          </p>
          {created ? (
            <p className="text-royal/70">
              <span className="font-medium text-royal">Member since</span>{" "}
              {created}
            </p>
          ) : null}
          <p className="flex flex-wrap items-center gap-2 text-royal/70">
            <span className="text-2xl" aria-hidden>
              {tierBadge}
            </span>
            <span className="font-medium text-royal">Plan:</span> {tierLabel}
          </p>
          {dirty ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void saveName()}
              className="rounded-lg bg-gold px-4 py-2 font-semibold text-royal disabled:opacity-50"
            >
              Save changes
            </button>
          ) : null}
          {msg ? <p className="text-sm text-royal/80">{msg}</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-xl font-semibold text-royal">Your data</h2>
        <p className="mt-2 font-sans text-sm text-royal/75">
          Download a portable JSON copy of your trips and account metadata (GDPR
          data portability).
        </p>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void downloadExport()}
          className="mt-4 rounded-lg border-2 border-royal/25 bg-white px-4 py-2 font-sans text-sm font-semibold text-royal hover:bg-cream disabled:opacity-50"
        >
          {exporting ? "Preparing…" : "Download all your data (JSON)"}
        </button>
      </section>

      {hasPasswordAuth ? (
        <section className="rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-royal">
            Security
          </h2>
          <p className="mt-2 font-sans text-sm text-royal/70">
            Change the password you use with email sign-in.
          </p>
          <div className="mt-4 space-y-3">
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              className="w-full rounded-lg border-2 border-royal/20 px-3 py-2 font-sans text-sm"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password (8+ characters)"
              className="w-full rounded-lg border-2 border-royal/20 px-3 py-2 font-sans text-sm"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              className="w-full rounded-lg border-2 border-royal/20 px-3 py-2 font-sans text-sm"
              value={confPw}
              onChange={(e) => setConfPw(e.target.value)}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => void changePw()}
              className="rounded-lg bg-royal px-4 py-2 font-sans text-sm font-semibold text-cream disabled:opacity-50"
            >
              Update password
            </button>
            {pwMsg ? (
              <p className="font-sans text-sm text-royal/80">{pwMsg}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void signOutEverywhere()}
            className="mt-6 font-sans text-sm font-semibold text-royal underline"
          >
            Sign out everywhere
          </button>
        </section>
      ) : oauthProviderLabel ? (
        <section className="rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-royal">
            Security
          </h2>
          <p className="mt-2 font-sans text-sm text-royal/70">
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
            className="mt-4 font-sans text-sm font-semibold text-royal underline"
          >
            Sign out everywhere
          </button>
        </section>
      ) : (
        <section className="rounded-2xl border border-royal/10 bg-white p-6 shadow-sm">
          <h2 className="font-serif text-xl font-semibold text-royal">
            Security
          </h2>
          <p className="mt-2 font-sans text-sm text-royal/70">
            You signed in with a magic link. To set a permanent password, use the
            password reset flow.
          </p>
          <button
            type="button"
            onClick={() => void signOutEverywhere()}
            className="mt-4 font-sans text-sm font-semibold text-royal underline"
          >
            Sign out everywhere
          </button>
        </section>
      )}

      <section className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-6">
        <h2 className="font-serif text-xl font-semibold text-red-900">
          Danger zone
        </h2>
        <p className="mt-2 font-sans text-sm leading-relaxed text-red-900/90">
          Permanently delete your account, all trips, custom tiles, and data.
          This cannot be undone. Purchases are non-refundable after deletion.
        </p>
        <p className="mt-2 font-sans text-xs text-red-900/75">
          Financial records may be retained for up to six years for UK tax
          purposes without personal identifiers where possible.
        </p>
        {!delOpen ? (
          <button
            type="button"
            onClick={() => {
              setDelOpen(true);
              setDelEmail("");
              setDelErr(null);
            }}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-red-800"
          >
            Delete my account
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="font-sans text-sm font-semibold text-red-900">
              Are you absolutely sure? Type your email to confirm.
            </p>
            <input
              className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 font-sans text-sm"
              placeholder={email}
              value={delEmail}
              onChange={(e) => setDelEmail(e.target.value)}
            />
            {delErr ? (
              <p className="font-sans text-sm text-red-800">{delErr}</p>
            ) : null}
            <button
              type="button"
              disabled={pending || delEmail.trim().toLowerCase() !== email.toLowerCase()}
              onClick={() => void confirmDelete()}
              className="rounded-lg bg-red-800 px-4 py-2 font-sans text-sm font-semibold text-white disabled:opacity-50"
            >
              Yes, delete everything
            </button>
            <button
              type="button"
              onClick={() => setDelOpen(false)}
              className="ml-3 font-sans text-sm text-royal underline"
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
