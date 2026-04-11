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
    msg.includes("invalid login") ||
    msg.includes("invalid email or password") ||
    msg.includes("invalid login credentials")
  ) {
    return "Incorrect password. Try again or use a magic link.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Check your email to confirm your account first.";
  }
  if (
    msg.includes("user not found") ||
    msg.includes("no user found") ||
    code === "user_not_found"
  ) {
    return "No account with this email. Sign up instead?";
  }
  if (
    code === "too_many_requests" ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("security purposes")
  ) {
    return "Too many attempts. Try again in a few minutes.";
  }
  return "Something went wrong, try again.";
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
    return { ok: false, error: "Enter your email and password." };
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
      error: e instanceof Error ? e.message : "Something went wrong.",
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
      error: e instanceof Error ? e.message : "Something went wrong.",
    };
  }
}

export async function resetPasswordAction(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter your email address." };
  }

  try {
    const origin = siteOrigin();
    if (!origin) {
      return { ok: false, error: "Server configuration error." };
    }

    const supabase = await createClient();
    /** User lands here with a recovery session (hash or PKCE); /reset-password handles password update. */
    const redirectTo = `${origin}/reset-password`;

    await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong.",
    };
  }
}
