import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Matches Supabase `EmailOtpType` for `verifyOtp`. */
const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const;

type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

function parseEmailOtpType(raw: string | null): EmailOtpType | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  return EMAIL_OTP_TYPES.includes(t as EmailOtpType) ? (t as EmailOtpType) : null;
}

function compactReason(msg: string, max = 600): string {
  if (msg.length <= max) return msg;
  return `${msg.slice(0, max)}…`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const rawNextParam = searchParams.get("next");
  const hasExplicitNext = String(rawNextParam ?? "").trim() !== "";
  const next = safeNextPath(rawNextParam);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const typeRaw = searchParams.get("type");
  const otpTypeFromQuery = parseEmailOtpType(typeRaw);

  const loginInvalid = () =>
    NextResponse.redirect(
      `${origin}/login?error=invalid_link&next=${encodeURIComponent(next)}`,
    );

  const loginAuthFailed = (message: string) =>
    NextResponse.redirect(
      `${origin}/login?error=auth_failed&reason=${encodeURIComponent(compactReason(message))}&next=${encodeURIComponent(next)}`,
    );

  /**
   * Recovery: honour explicit `next` when present (safe path); otherwise
   * default to /reset-password. Other flows use `next` (defaults via safeNextPath).
   */
  const postAuthPath =
    otpTypeFromQuery === "recovery"
      ? hasExplicitNext
        ? next
        : safeNextPath("/reset-password")
      : next;

  const successRedirect = () =>
    NextResponse.redirect(`${origin}${postAuthPath}`);

  // 1) PKCE (OAuth, email OTP with code exchange)
  if (code) {
    const redirectResponse = successRedirect();
    try {
      const supabase = createRouteHandlerSupabaseClient(request, redirectResponse);
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return loginAuthFailed(error.message);
      }
      return redirectResponse;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return loginAuthFailed(msg);
    }
  }

  // 2) Magic link / email confirmation — ?token_hash=...&type=...
  if (tokenHash && typeRaw) {
    const otpType = parseEmailOtpType(typeRaw);
    if (!otpType) {
      return loginAuthFailed(`Invalid or unsupported OTP type: ${typeRaw}`);
    }

    const redirectResponse = successRedirect();
    try {
      const supabase = createRouteHandlerSupabaseClient(request, redirectResponse);
      const { error } = await supabase.auth.verifyOtp({
        type: otpType,
        token_hash: tokenHash,
      });
      if (error) {
        return loginAuthFailed(error.message);
      }
      return redirectResponse;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return loginAuthFailed(msg);
    }
  }

  // 3) Missing required params
  return loginInvalid();
}
