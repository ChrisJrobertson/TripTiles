"use server";

import { safeNextPath } from "@/lib/auth/safe-next-path";
import { getPublicSiteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AuthError } from "@supabase/supabase-js";

function siteOrigin(): string {
  const s = getPublicSiteUrl().trim();
  if (s && /^https?:\/\//i.test(s)) return s;
  return "";
}

function authCallbackUrl(next: string): string | null {
  const origin = siteOrigin();
  const path = safeNextPath(next);
  if (!origin) return null;
  return `${origin}/auth/callback?next=${encodeURIComponent(path)}`;
}

function mapSignInError(error: AuthError): string {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();

  if (
    code === "invalid_credentials" ||
    code === "user_not_found" ||
    msg.includes("invalid login") ||
    msg.includes("invalid email or password") ||
    msg.includes("invalid login credentials") ||
    msg.includes("user not found") ||
    msg.includes("no user found")
  ) {
    return "Incorrect email or password";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Please confirm your email first — check your inbox";
  }
  if (
    code === "too_many_requests" ||
    msg.includes("over_email_send_rate_limit") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("security purposes")
  ) {
    return "Too many attempts, try again in a few minutes.";
  }
  return "Something went wrong. Please try again.";
}

function mapSignUpError(error: AuthError): string {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();

  if (
    code === "user_already_registered" ||
    msg.includes("already registered") ||
    msg.includes("already been registered")
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (code === "weak_password" || msg.includes("password")) {
    return error.message || "Choose a stronger password (at least 8 characters).";
  }
  return error.message || "Something went wrong, try again.";
}

export async function signInWithPasswordAction(
  email: string,
  password: string,
  next: string,
): Promise<
  { ok: true; redirectTo: string } | { ok: false; error: string }
> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    return { ok: false, error: "Email and password are required" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error) {
      return { ok: false, error: mapSignInError(error) };
    }

    revalidatePath("/", "layout");
    revalidatePath("/planner");
    return { ok: true, redirectTo: safeNextPath(next) };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong. Please try again.",
    };
  }
}

export async function signUpWithPasswordAction(
  email: string,
  password: string,
): Promise<
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; error: string }
> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    return { ok: false, error: "Enter your email and password." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  try {
    const cb = authCallbackUrl("/planner");
    if (!cb) {
      return {
        ok: false,
        error:
          "Sign-up is not configured: set NEXT_PUBLIC_SITE_URL for confirmation links.",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: cb,
      },
    });

    if (error) {
      return { ok: false, error: mapSignUpError(error) };
    }

    const needsEmailConfirmation = !data.session;
    revalidatePath("/", "layout");
    return { ok: true, needsEmailConfirmation };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong. Please try again.",
    };
  }
}

export async function resetPasswordAction(
  email: string,
): Promise<{ ok: true }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: true };
  }

  try {
    const origin = siteOrigin();
    if (!origin) {
      return { ok: true };
    }

    const supabase = await createClient();
    /** Exchange on server then send user to /reset-password (SSR session + server update password). */
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

    await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });
  } catch {
    // Always succeed from the caller's perspective (no user enumeration).
  }

  return { ok: true };
}

export async function updatePasswordAction(
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        ok: false,
        error:
          "This reset link is invalid or has expired. Request a new one from forgot password.",
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/", "layout");
    revalidatePath("/planner");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong.",
    };
  }
}
