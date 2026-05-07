"use client";

import { resetPasswordAction } from "@/actions/auth";
import { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS } from "@/components/auth/auth-field-classes";
import { useGlobalLoading } from "@/components/app/GlobalLoadingContext";
import { Button } from "@/components/ui/Button";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { withLoading, busy } = useGlobalLoading();
  const [email, setEmail] = useState("");

  useEffect(() => {
    const q = searchParams.get("email");
    if (q) setEmail(q);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    try {
      await withLoading("Sending your reset code…", async () => {
        await resetPasswordAction({ email: trimmed });
      });
    } catch {
      // Still continue — avoid revealing whether the email exists.
    }
    router.push(`/reset-password/verify?email=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <p className="font-sans text-sm leading-relaxed text-tt-ink-muted">
        Enter your email and we&apos;ll send an 8-digit code you can use on the
        next step.
      </p>
      <div>
        <label htmlFor="forgot-email" className={AUTH_LABEL_CLASS}>
          Email address
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={AUTH_INPUT_CLASS}
          placeholder="you@example.com"
        />
      </div>
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Send reset code"}
      </Button>
    </form>
  );
}
