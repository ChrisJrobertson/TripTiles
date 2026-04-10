"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "min-h-12 w-full rounded-lg border-2 border-royal/25 bg-white px-4 text-base text-royal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40";

type Props = {
  next: string;
};

export function LoginForm({ next }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error: signError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callbackUrl,
        },
      });

      if (signError) {
        setError(signError.message);
        setLoading(false);
        return;
      }

      router.push("/login/check-email");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (!mounted) {
    return (
      <div
        className="mt-8 space-y-6"
        aria-busy="true"
        aria-label="Loading sign-in form"
      >
        <div>
          <div className="mb-2 h-4 w-32 rounded bg-royal/15" />
          <div className="min-h-12 w-full rounded-lg border-2 border-royal/10 bg-white/60" />
        </div>
        <div className="min-h-12 w-full rounded-lg bg-gold/20" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <div>
        <label
          htmlFor="login-email"
          className="mb-2 block font-serif text-sm font-medium text-royal"
        >
          Email address
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>

      <div aria-live="polite" role="status">
        {error ? (
          <p
            id="login-error"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
