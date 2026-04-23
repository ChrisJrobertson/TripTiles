"use client";

import { sendSignInOtpAction, signInWithPasswordAction } from "@/actions/auth";
import { useGlobalLoading } from "@/components/app/GlobalLoadingContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PasswordField } from "@/components/auth/PasswordField";

const inputClass =
  "min-h-12 w-full rounded-lg border-2 border-royal/25 bg-white px-4 text-base text-royal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40";

type Props = {
  next: string;
  initialEmail?: string;
};

type LoadPhase = "idle" | "code" | "password";

export function LoginForm({ next, initialEmail = "" }: Props) {
  const router = useRouter();
  const { begin, end, busy } = useGlobalLoading();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  async function handleSendCode() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address first.");
      return;
    }
    setPhase("code");
    begin("Sending your sign-in code…");
    try {
      const result = await sendSignInOtpAction({ email: trimmed });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(
        `/login/check-email?email=${encodeURIComponent(trimmed)}&next=${encodeURIComponent(next)}`,
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      end();
      setPhase("idle");
    }
  }

  async function handlePasswordSignIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }
    setPhase("password");
    begin("Signing you in…");
    try {
      const result = await signInWithPasswordAction({
        email: email.trim(),
        password,
        next,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      end();
      setPhase("idle");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.trim().length > 0) {
      await handlePasswordSignIn();
      return;
    }
    await handleSendCode();
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-5">
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
        label="Password (optional if using a sign-in code)"
        helperText="Leave blank to receive an 8-digit sign-in code by email"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        required={false}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <button
          type="submit"
          disabled={busy}
          className="flex min-h-12 min-w-[44px] flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "code" ? "Sending…" : "Send sign-in code"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handlePasswordSignIn()}
          className="flex min-h-12 min-w-[44px] flex-1 items-center justify-center rounded-lg border-2 border-royal/25 bg-white px-4 font-sans text-sm font-semibold text-royal transition hover:border-royal/40 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "password" ? "Signing in…" : "Sign in with password"}
        </button>
      </div>

      <p className="text-center font-sans text-xs">
        <Link
          href={`/forgot-password?email=${encodeURIComponent(email.trim())}`}
          className="font-medium text-royal/70 underline decoration-gold/50 underline-offset-2 hover:text-gold"
        >
          Forgot password?
        </Link>
      </p>

      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1 bg-royal/15" />
        <span className="font-sans text-xs tracking-wide text-royal/45">
          ── or ──
        </span>
        <div className="h-px flex-1 bg-royal/15" />
      </div>

      <p className="text-center font-sans text-sm text-royal/70">
        Don&apos;t have an account?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-royal underline decoration-gold/60 underline-offset-2 hover:text-gold"
        >
          Create one
        </Link>
      </p>
    </form>
  );
}
