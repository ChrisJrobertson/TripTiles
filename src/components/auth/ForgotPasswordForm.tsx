"use client";

import { resetPasswordAction } from "@/actions/auth";
import { useGlobalLoading } from "@/components/app/GlobalLoadingContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const inputClass =
  "min-h-12 w-full rounded-lg border-2 border-royal/25 bg-white px-4 text-base text-royal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40";

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
    router.push(
      `/reset-password/verify?email=${encodeURIComponent(trimmed)}`,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <p className="font-sans text-sm leading-relaxed text-royal/75">
        Enter your email and we&apos;ll send an 8-digit code you can use on the
        next step.
      </p>
      <div>
        <label
          htmlFor="forgot-email"
          className="mb-2 block font-serif text-sm font-medium text-royal"
        >
          Email address
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="flex min-h-12 min-w-[44px] w-full items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send reset code"}
      </button>
    </form>
  );
}
