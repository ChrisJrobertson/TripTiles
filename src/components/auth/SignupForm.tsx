"use client";

import { signUpWithPasswordAction } from "@/actions/auth";
import { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS } from "@/components/auth/auth-field-classes";
import { useGlobalLoading } from "@/components/app/GlobalLoadingContext";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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
  const { withLoading, busy } = useGlobalLoading();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const strength = useMemo(() => passwordStrength(password), [password]);
  const strengthPct = strength === "weak" ? 33 : strength === "ok" ? 66 : 100;
  const strengthColor =
    strength === "weak"
      ? "bg-amber-500"
      : strength === "ok"
        ? "bg-tt-gold"
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

    try {
      await withLoading("Creating your account…", async () => {
        const r = await signUpWithPasswordAction({
          email: trimmedEmail,
          password,
        });
        if (!r.ok) {
          setError(r.error);
          return;
        }

        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.push(safeNextPath(next));
          router.refresh();
          return;
        }

        router.push(`/signup/verify?email=${encodeURIComponent(trimmedEmail)}`);
      });
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  const safeNext = encodeURIComponent(next);

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="signup-email" className={AUTH_LABEL_CLASS}>
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
          className={AUTH_INPUT_CLASS}
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
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-tt-line/40">
            <div
              className={`h-full rounded-full transition-all ${strengthColor}`}
              style={{ width: `${strengthPct}%` }}
            />
          </div>
          <span className="font-sans text-xs tabular-nums text-tt-ink-muted">
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
        <p className="rounded-tt-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800">
          {error.includes("already exists") ? (
            <>
              {error}{" "}
              <Link
                href={`/login?next=${safeNext}`}
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

      <p className="text-center font-sans text-xs leading-relaxed text-tt-ink-muted">
        By signing up you agree to our{" "}
        <Link
          href="/terms"
          className="font-semibold text-tt-royal underline decoration-tt-gold/45 underline-offset-2"
        >
          Terms
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy"
          className="font-semibold text-tt-royal underline decoration-tt-gold/45 underline-offset-2"
        >
          Privacy
        </Link>
        .
      </p>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </Button>

      <p className="text-center font-sans text-xs text-tt-ink-muted">
        We&apos;ll email you an 8-digit code to confirm your account.
      </p>

      <div className="border-t border-tt-line/60 pt-5">
        <Link
          href={`/login?next=${safeNext}${email.trim() ? `&email=${encodeURIComponent(email.trim())}` : ""}`}
          className="flex min-h-11 w-full items-center justify-center rounded-tt-md border border-tt-line bg-transparent px-4 font-heading text-sm font-semibold text-tt-royal transition hover:bg-tt-surface-warm"
        >
          Sign in with a code instead
        </Link>
      </div>

      <p className="text-center font-sans text-sm text-tt-ink-muted">
        Already have an account?{" "}
        <Link
          href={`/login?next=${safeNext}`}
          className="font-semibold text-tt-royal underline decoration-tt-gold/55 underline-offset-2 hover:text-tt-gold"
        >
          Sign in
        </Link>
      </p>

      {/* TODO post-launch: social sign-in (Google / Apple) */}
    </form>
  );
}
