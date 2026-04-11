"use client";

import { updatePasswordAction } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/auth/PasswordField";
import { showToast } from "@/lib/toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Recovery links should hit `/auth/callback` first so the session is in
 * cookies; then `updatePasswordAction` runs on the server with that session.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const r = await updatePasswordAction(password);
      if (!r.ok) {
        setError(r.error);
        setLoading(false);
        return;
      }
      showToast("Password updated. You're signed in.");
      router.push("/planner");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="mt-8 space-y-3 font-sans text-sm text-royal/70">
        <p>Checking your reset link…</p>
        <p className="text-xs text-royal/55">
          If this page stays here, open the link from your email again or
          request a new reset from{" "}
          <Link href="/forgot-password" className="underline">
            forgot password
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <h2 className="font-serif text-lg font-semibold text-royal">
        Set a new password
      </h2>
      <PasswordField
        id="reset-new"
        label="New password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={8}
        required
      />
      <PasswordField
        id="reset-confirm"
        label="Confirm new password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        minLength={8}
        required
      />
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95 disabled:opacity-60"
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
