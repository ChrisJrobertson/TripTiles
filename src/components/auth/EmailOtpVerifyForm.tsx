"use client";

import {
  resendSignupOtpAction,
  resetPasswordAction,
  sendSignInOtpAction,
  verifyRecoveryOtpAction,
  verifySignInOtpAction,
  verifySignupOtpAction,
} from "@/actions/auth";
import { OTP_LENGTH, OtpInput } from "@/components/auth/OtpInput";
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
      <p className="font-serif text-base leading-relaxed text-royal/85">
        We&apos;ve sent an 8-digit code to{" "}
        <span className="break-all font-semibold text-royal">{email}</span>.
      </p>
      <p className="font-sans text-sm text-royal/75">{introLine(mode)}</p>

      <div className="space-y-3">
        <label
          htmlFor="email-otp-input"
          className="block font-serif text-sm font-medium text-royal"
        >
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

      <button
        type="button"
        disabled={verifying || otp.replace(/\D/g, "").length !== OTP_LENGTH}
        onClick={() => void handleVerify()}
        className="flex min-h-11 w-full min-w-[44px] items-center justify-center rounded-lg bg-gradient-to-r from-gold to-[#b8924f] px-4 py-2.5 font-serif text-base font-semibold text-royal shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[44px]"
      >
        {verifying ? "Verifying…" : "Verify"}
      </button>

      <p className="text-center font-sans text-sm text-royal/70">
        {cooldown > 0 ? (
          <>Didn&apos;t arrive? Resend in {cooldown}s</>
        ) : (
          <button
            type="button"
            disabled={resendPending}
            onClick={() => void handleResend()}
            className="min-h-11 min-w-[44px] font-semibold text-royal underline decoration-gold/60 underline-offset-2 hover:text-gold disabled:opacity-50"
          >
            {resendPending ? "Sending…" : "Resend code"}
          </button>
        )}
      </p>

      <p className="text-center">
        <Link
          href={backHref}
          className="inline-flex min-h-11 min-w-[44px] items-center justify-center font-sans text-sm font-medium text-royal underline decoration-gold/50 underline-offset-2 hover:text-gold"
        >
          Use a different email
        </Link>
      </p>
    </div>
  );
}
