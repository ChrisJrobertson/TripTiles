"use client";

import { resetPasswordAction } from "@/actions/auth";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("email");
    if (q) setEmail(q);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await resetPasswordAction(email.trim());
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div
        className="mt-8 rounded-lg border border-gold/40 bg-white px-4 py-5 font-sans text-sm text-royal shadow-sm"
        role="status"
      >
        <p className="font-semibold text-royal">
          If an account exists with this email, a reset link has been sent.
        </p>
        <p className="mt-4">
          <Link href="/login" className="font-semibold text-gold underline">
            Back to login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
        {loading ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
