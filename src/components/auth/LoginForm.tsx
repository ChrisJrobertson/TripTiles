"use client";

import { sendSignInOtpAction, signInWithPasswordAction } from "@/actions/auth";
import { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS } from "@/components/auth/auth-field-classes";
import { useGlobalLoading } from "@/components/app/GlobalLoadingContext";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/Button";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
            className="rounded-tt-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="login-email" className={AUTH_LABEL_CLASS}>
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
          className={AUTH_INPUT_CLASS}
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
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="min-h-12 flex-1"
          disabled={busy}
        >
          {phase === "code" ? "Sending…" : "Send sign-in code"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="min-h-12 flex-1"
          disabled={busy}
          onClick={() => void handlePasswordSignIn()}
        >
          {phase === "password" ? "Signing in…" : "Sign in with password"}
        </Button>
      </div>

      <p className="text-center font-sans text-xs">
        <Link
          href={`/forgot-password?email=${encodeURIComponent(email.trim())}`}
          className="font-medium text-tt-royal underline decoration-tt-gold/50 underline-offset-2 hover:text-tt-gold"
        >
          Forgot password?
        </Link>
      </p>

      <p className="pt-2 text-center font-sans text-sm text-tt-ink-muted">
        Don&apos;t have an account?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-semibold text-tt-royal underline decoration-tt-gold/55 underline-offset-2 hover:text-tt-gold"
        >
          Create one
        </Link>
      </p>

      {/* TODO post-launch: social sign-in (Google / Apple) */}
    </form>
  );
}
