"use client";

import { updatePasswordAction } from "@/actions/auth";
import { useGlobalLoading } from "@/components/app/GlobalLoadingContext";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetPasswordForm() {
  const router = useRouter();
  const { withLoading, busy } = useGlobalLoading();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    try {
      await withLoading("Updating your password…", async () => {
        const r = await updatePasswordAction({ newPassword: password });
        if (!r.ok) {
          setError(r.error);
          return;
        }
        showToast("Password updated. You're signed in.", { type: "success" });
        router.push("/planner");
        router.refresh();
      });
    } catch {
      setError("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <h2 className="font-heading text-lg font-semibold text-tt-royal">
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
        <p className="rounded-tt-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
