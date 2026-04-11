"use server";

import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AuthError } from "@supabase/supabase-js";

function publicSiteUrl(): string {
  const raw = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.triptiles.app"
  ).trim();
  return raw.replace(/\/$/, "");
}

function mapSignInError(error: AuthError): string {
  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();
  const blob = `${code} ${msg}`;

  if (
    code === "invalid_credentials" ||
    code === "user_not_found" ||
    blob.includes("invalid_credentials") ||
    blob.includes("invalid login") ||
    blob.includes("invalid email or password") ||
    blob.includes("invalid login credentials") ||
    blob.includes("user not found") ||
    blob.includes("no user found")
  ) {
    return "Incorrect email or password";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Please confirm your email first - check your inbox";
  }
  if (
    code === "too_many_requests" ||
    blob.includes("over_email_send_rate_limit") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("security purposes")
  ) {
    return "Too many attempts. Try again in a few minutes.";
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
    return "An account with this email already exists. Sign in instead?";
  }
  if (code === "weak_password" || msg.includes("password")) {
    return error.message || "Password must be at least 8 characters";
  }
  return error.message || "Something went wrong. Please try again.";
}

export async function signInWithPasswordAction(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<
  { ok: true; redirectTo: string } | { ok: false; error: string }
> {
  const trimmedEmail = input.email.trim();
  if (!trimmedEmail || !input.password) {
    return { ok: false, error: "Email and password are required" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: input.password,
    });

    if (error) {
      return { ok: false, error: mapSignInError(error) };
    }

    revalidatePath("/", "layout");
    revalidatePath("/planner");
    const redirectTo = safeNextPath(input.next);
    return { ok: true, redirectTo };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
    };
  }
}

export async function signUpWithPasswordAction(input: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedEmail = input.email.trim();
  if (!trimmedEmail || !input.password) {
    return { ok: false, error: "Email and password are required" };
  }
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }

  try {
    const siteUrl = publicSiteUrl();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: input.password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=/planner`,
      },
    });

    if (error) {
      return { ok: false, error: mapSignUpError(error) };
    }

    if (data.session) {
      revalidatePath("/", "layout");
      revalidatePath("/planner");
    } else {
      revalidatePath("/", "layout");
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
    };
  }
}

export async function resetPasswordAction(input: {
  email: string;
}): Promise<{ ok: true }> {
  const trimmed = input.email.trim();
  if (!trimmed) {
    return { ok: true };
  }

  try {
    const siteUrl = publicSiteUrl();
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    });
  } catch {
    /* always succeed from caller's perspective */
  }

  return { ok: true };
}

export async function updatePasswordAction(input: {
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.newPassword || input.newPassword.length < 8) {
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
          "This reset link is invalid or has expired. Request a new one.",
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: input.newPassword,
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
