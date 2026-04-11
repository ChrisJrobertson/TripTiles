"use client";

import { signUpWithPasswordAction } from "@/actions/auth";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { PasswordField } from "@/components/auth/PasswordField";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const inputClass =
  "min-h-12 w-full rounded-lg border-2 border-royal/25 bg-white px-4 text-base text-royal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/40";

function passwordStrength(pw: string): "weak" | "ok" | "strong" {
  if (pw.length < 8) return "weak";
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const mixed = (hasLower && hasUpper) || (hasLower && hasDigit) || (hasUpper && hasDigit);
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

  const strength = useMemo(() => passwordStrength(password), [password]);
  const strengthPct =
    strength === "weak" ? 33 : strength === "ok" ? 66 : 100;
  const strengthColor =
    strength === "weak"
      ? "bg-amber-500"
      : strength === "ok"
        ? "bg-gold"
        : "bg-emerald-600";

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
      const r = await signUpWithPasswordAction(email.trim(), password);
      if (!r.ok) {
        setError(r.error);
        setLoading(false);
        return;
      }
      if (!r.needsEmailConfirmation) {
        setLoading(false);
        router.push(safeNextPath(next));
        router.refresh();
        return;
      }
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
        <p className="font-semibold text-royal">Check your email to confirm your account</p>
        <p className="mt-2 text-royal/75">
          We sent a confirmation link. After you confirm, you can sign in with
          your password or request a magic link.
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
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <PasswordField
          id="signup-password"
          label="Password"
          helperText="At least 8 characters."
          value={password}
          onChange={setPassword}
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
          <span className="font-sans text-xs capitalize text-royal/60">
            {strength}
          </span>
        </div>
        <p className="mt-1 font-sans text-xs text-royal/45">
          {password.length} / 8+ characters (strength is a guide only)
        </p>
      </div>

      <PasswordField
        id="signup-confirm"
        label="Confirm password"
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
        {loading ? "Creating…" : "Create account"}
      </button>

      <p className="text-center font-sans text-xs text-royal/55">
        We&apos;ll send you a confirmation email to activate your account.
      </p>

      <div className="flex items-center gap-3 pt-2">
        <div className="h-px flex-1 bg-royal/15" />
        <span className="font-sans text-xs text-royal/45">or</span>
        <div className="h-px flex-1 bg-royal/15" />
      </div>

      <p className="text-center font-sans text-sm text-royal/70">
        <Link
          href={`/login?next=${encodeURIComponent(next)}${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""}`}
          className="font-semibold text-royal underline decoration-gold/60 underline-offset-2 hover:text-gold"
        >
          Use a magic link instead
        </Link>
      </p>
    </form>
  );
}
