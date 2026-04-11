"use client";

import { signInWithPasswordAction } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PasswordField } from "@/components/auth/PasswordField";

const inputClass =
  "min-h-12 w-full rounded-lg border-2 border-royal/25 bg-white px-4 text-base text-royal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40";

/** Prefer `NEXT_PUBLIC_SITE_URL` so magic links match Supabase redirect allowlist in production. */
function callbackOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/$/, "");
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}

type Props = {
  next: string;
  initialEmail?: string;
};

export function LoginForm({ next, initialEmail = "" }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [magicLoading, setMagicLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMagicLoading(true);

    try {
      const supabase = createClient();
      const origin = callbackOrigin();
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error: signError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callbackUrl,
        },
      });

      if (signError) {
        const m = signError.message.toLowerCase();
        if (m.includes("rate limit") || m.includes("too many")) {
          setError("Too many attempts. Try again in a few minutes.");
        } else {
          setError(signError.message);
        }
        setMagicLoading(false);
        return;
      }

      router.push("/login/check-email");
    } catch {
      setError("Something went wrong. Please try again.");
      setMagicLoading(false);
    }
  }

  async function handlePasswordSignIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password to sign in with a password.");
      return;
    }
    setPasswordLoading(true);
    try {
      const result = await signInWithPasswordAction(
        email.trim(),
        password,
        next,
      );
      if (!result.ok) {
        setError(result.error);
        setPasswordLoading(false);
        return;
      }
      router.push(result.redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setPasswordLoading(false);
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
    <form onSubmit={handleMagicLink} className="mt-8 space-y-5">
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

      <PasswordField
        label="Password (optional)"
        helperText="Leave blank to sign in with a magic link."
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        required={false}
      />

      {password.trim().length > 0 ? (
        <p className="text-right font-sans text-xs">
          <Link
            href={`/forgot-password?email=${encodeURIComponent(email.trim())}`}
            className="font-medium text-royal underline decoration-gold/60 underline-offset-2 hover:text-gold"
          >
            Forgot password?
          </Link>
        </p>
      ) : null}

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <button
          type="submit"
          disabled={magicLoading || passwordLoading}
          className="flex min-h-12 flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {magicLoading ? "Sending…" : "Send magic link"}
        </button>
        <button
          type="button"
          disabled={magicLoading || passwordLoading}
          onClick={() => void handlePasswordSignIn()}
          className="flex min-h-12 flex-1 items-center justify-center rounded-lg border-2 border-royal/25 bg-white px-4 font-sans text-sm font-semibold text-royal transition hover:border-royal/40 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {passwordLoading ? "Signing in…" : "Sign in with password"}
        </button>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-royal/15" />
        <span className="font-sans text-xs text-royal/45">or</span>
        <div className="h-px flex-1 bg-royal/15" />
      </div>

      <p className="text-center font-sans text-sm text-royal/70">
        Don&apos;t have an account?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-royal underline decoration-gold/60 underline-offset-2 hover:text-gold"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
