"use client";

import {
  resendSignupOtpAction,
  resetPasswordAction,
  sendSignInOtpAction,
  verifyRecoveryOtpAction,
  verifySignInOtpAction,
  verifySignupOtpAction,
} from "@/actions/auth";
import { AUTH_LABEL_CLASS } from "@/components/auth/auth-field-classes";
import { OTP_LENGTH, OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/Button";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import Link from "next/link";
import { useEffect, useState } from "react";

const COOLDOWN_SEC = 60;

type Mode = "signin" | "signup" | "recovery";

type Props = {
  mode: Mode;
  email: string;
  /** Used for sign-in redirect only; defaults to /planner */
  next?: string;
};

function introLine(mode: Mode): string {
  switch (mode) {
    case "signin":
      return "Enter the code below to sign in.";
    case "signup":
      return "Enter the code below to confirm your account.";
    case "recovery":
      return "Enter the code below to continue to reset your password.";
    default:
      return "";
  }
}

export function EmailOtpVerifyForm({ mode, email, next }: Props) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(COOLDOWN_SEC);
  const [verifying, setVerifying] = useState(false);
  const [resendPending, setResendPending] = useState(false);

  const safeNext = safeNextPath(next);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  async function handleVerify() {
    setError(null);
    const token = otp.replace(/\D/g, "");
    if (token.length !== OTP_LENGTH) {
      setError(
        "That code didn't match. Check for typos or request a new one.",
      );
      return;
    }

    setVerifying(true);
    try {
      if (mode === "signin") {
        const r = await verifySignInOtpAction({
          email,
          token,
          next: safeNext,
        });
        if (r?.ok === false) {
          setError(r.error);
          setOtp("");
        }
        return;
      }
      if (mode === "signup") {
        const r = await verifySignupOtpAction({ email, token });
        if (r?.ok === false) {
          setError(r.error);
          setOtp("");
        }
        return;
      }
      const r = await verifyRecoveryOtpAction({ email, token });
      if (r?.ok === false) {
        setError(r.error);
        setOtp("");
      }
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resendPending) return;
    setError(null);
    setResendPending(true);
    try {
      if (mode === "signin") {
        const r = await sendSignInOtpAction({ email });
        if (!r.ok) {
          setError(r.error);
          return;
        }
      } else if (mode === "signup") {
        const r = await resendSignupOtpAction({ email });
        if (!r.ok) {
          setError(r.error);
          return;
        }
      } else {
        await resetPasswordAction({ email });
      }
      setCooldown(COOLDOWN_SEC);
    } finally {
      setResendPending(false);
    }
  }

  const backHref =
    mode === "signin"
      ? `/login?next=${encodeURIComponent(safeNext)}`
      : mode === "signup"
        ? "/signup"
        : "/forgot-password";

  return (
    <div className="w-full max-w-md space-y-6">
      <p className="font-sans text-base leading-relaxed text-tt-royal">
        We&apos;ve sent an 8-digit code to{" "}
        <span className="break-all font-semibold">{email}</span>.
      </p>
      <p className="font-sans text-sm text-tt-ink-muted">{introLine(mode)}</p>

      <div className="space-y-3">
        <label htmlFor="email-otp-input" className={`${AUTH_LABEL_CLASS} mb-0`}>
          Code
        </label>
        <OtpInput
          id="email-otp-input"
          value={otp}
          onChange={setOtp}
          disabled={verifying}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "otp-verify-error" : undefined}
        />
        {error ? (
          <p
            id="otp-verify-error"
            className="font-sans text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={verifying || otp.replace(/\D/g, "").length !== OTP_LENGTH}
        loading={verifying}
        loadingLabel="Verifying…"
        onClick={() => void handleVerify()}
      >
        Verify
      </Button>

      <p className="text-center font-sans text-sm text-tt-ink-muted">
        {cooldown > 0 ? (
          <>Didn&apos;t arrive? Resend in {cooldown}s</>
        ) : (
          <button
            type="button"
            disabled={resendPending}
            onClick={() => void handleResend()}
            className="min-h-11 min-w-[44px] font-semibold text-tt-royal underline decoration-tt-gold/55 underline-offset-2 hover:text-tt-gold disabled:opacity-50"
          >
            {resendPending ? "Sending…" : "Resend code"}
          </button>
        )}
      </p>

      <p className="text-center">
        <Link
          href={backHref}
          className="inline-flex min-h-11 min-w-[44px] items-center justify-center font-sans text-sm font-medium text-tt-royal underline decoration-tt-gold/50 underline-offset-2 hover:text-tt-gold"
        >
          Use a different email
        </Link>
      </p>
    </div>
  );
}
