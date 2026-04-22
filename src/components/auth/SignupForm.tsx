"use client";

import { signUpWithPasswordAction } from "@/actions/auth";
import { TripTilesAuthSpinner } from "@/components/auth/TripTilesAuthSpinner";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/auth/PasswordField";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const inputClass =
  "min-h-12 w-full rounded-lg border-2 border-royal/25 bg-white px-4 text-base text-royal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordStrength(pw: string): "weak" | "ok" | "strong" {
  if (pw.length < 8) return "weak";
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const mixed =
    (hasLower && hasUpper) || (hasLower && hasDigit) || (hasUpper && hasDigit);
  if (pw.length >= 12 && mixed) return "strong";
  if (pw.length >= 8 && mixed) return "ok";
  if (pw.length >= 10) return "ok";
  return "weak";
}

type Props = {
  next: string;
};

export function SignupForm({ next }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successEmail, setSuccessEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const strengthPct = strength === "weak" ? 33 : strength === "ok" ? 66 : 100;
  const strengthColor =
    strength === "weak"
      ? "bg-amber-500"
      : strength === "ok"
        ? "bg-gold"
        : "bg-emerald-600";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmError(null);

    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setConfirmError("Passwords must match.");
      return;
    }

    setLoading(true);
    try {
      const r = await signUpWithPasswordAction({
        email: trimmedEmail,
        password,
      });
      if (!r.ok) {
        setLoading(false);
        setError(r.error);
        return;
      }

      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setLoading(false);
        router.push(safeNextPath(next));
        router.refresh();
        return;
      }

      setSuccessEmail(trimmedEmail);
      setEmail("");
      setPassword("");
      setConfirm("");
      setSuccess(true);
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        className="mt-8 rounded-lg border border-gold/40 bg-white px-4 py-5 font-sans text-sm text-royal shadow-sm"
        role="status"
      >
        <p className="leading-relaxed text-royal/90">
          Check your email - we&apos;ve sent a confirmation link to{" "}
          <span className="break-all font-semibold text-royal">
            {successEmail}
          </span>
          . Click it to activate your account and get planning.
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
        message="Creating your account…"
      />
      <div>
        <label
          htmlFor="signup-email"
          className="mb-2 block font-serif text-sm font-medium text-royal"
        >
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError(null);
          }}
          className={inputClass}
          placeholder="you@example.com"
          aria-invalid={emailError ? true : undefined}
        />
        {emailError ? (
          <p className="mt-1 font-sans text-xs text-red-700">{emailError}</p>
        ) : null}
      </div>

      <div>
        <PasswordField
          id="signup-password"
          label="Password"
          helperText="8+ characters"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setPasswordError(null);
          }}
          autoComplete="new-password"
          minLength={8}
          required
        />
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-royal/10">
            <div
              className={`h-full rounded-full transition-all ${strengthColor}`}
              style={{ width: `${strengthPct}%` }}
            />
          </div>
          <span className="font-sans text-xs tabular-nums text-royal/60">
            {password.length} / 8+
          </span>
        </div>
        {passwordError ? (
          <p className="mt-1 font-sans text-xs text-red-700">{passwordError}</p>
        ) : null}
      </div>

      <div>
        <PasswordField
          id="signup-confirm"
          label="Confirm password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setConfirmError(null);
          }}
          autoComplete="new-password"
          minLength={8}
          required
        />
        {confirmError ? (
          <p className="mt-1 font-sans text-xs text-red-700">{confirmError}</p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800">
          {error.includes("already exists") ? (
            <>
              {error}{" "}
              <Link
                href={`/login?next=${encodeURIComponent(next)}`}
                className="font-semibold underline"
              >
                Sign in
              </Link>
            </>
          ) : (
            error
          )}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95 disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create account"}
      </button>

      <p className="text-center font-sans text-xs text-royal/55">
        We&apos;ll send you a confirmation email to activate your account.
      </p>

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-royal/15" />
        <span className="font-sans text-xs tracking-wide text-royal/45">
          ── or ──
        </span>
        <div className="h-px flex-1 bg-royal/15" />
      </div>

      <Link
        href={`/login?next=${encodeURIComponent(next)}${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""}`}
        className="flex min-h-11 w-full items-center justify-center rounded-lg border-2 border-gold/70 bg-transparent px-4 font-serif text-sm font-semibold text-royal transition hover:bg-gold/10"
      >
        Use a magic link instead
      </Link>
    </form>
  );
}
