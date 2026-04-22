"use client";

import { resetPasswordAction } from "@/actions/auth";
import { TripTilesAuthSpinner } from "@/components/auth/TripTilesAuthSpinner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const inputClass =
  "min-h-12 w-full rounded-lg border-2 border-royal/25 bg-white px-4 text-base text-royal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("email");
    if (q) setEmail(q);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    setLoading(true);
    await resetPasswordAction({ email: trimmed });
    setLoading(false);
    setSentTo(trimmed || "that address");
    setDone(true);
  }

  if (done) {
    return (
      <div
        className="mt-8 rounded-lg border border-gold/40 bg-white px-4 py-5 font-sans text-sm text-royal shadow-sm"
        role="status"
      >
        <p className="font-semibold leading-relaxed text-royal">
          Check your email. If an account exists for{" "}
          <span className="break-all text-royal/90">{sentTo}</span>, we&apos;ve
          sent a reset link. It&apos;ll arrive in a few seconds.
        </p>
        <p className="mt-4">
          <Link href="/login" className="font-semibold text-gold underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <TripTilesAuthSpinner
        visible={loading}
        message="Sending your reset link…"
      />
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
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95 disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
