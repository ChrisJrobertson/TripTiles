"use server";

import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";

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

const VERIFY_OTP_MISMATCH =
  "That code didn't match. Check for typos or request a new one.";

const NO_ACCOUNT_FOR_OTP =
  "No account found with that email. Try signing up instead.";

function mapSignInOtpSendError(error: AuthError): string {
  const msg = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  const blob = `${code} ${msg}`;
  if (
    msg.includes("user not found") ||
    msg.includes("not registered") ||
    msg.includes("no user") ||
    msg.includes("signups not allowed") ||
    msg.includes("could not find") ||
    blob.includes("user_not_found")
  ) {
    return NO_ACCOUNT_FOR_OTP;
  }
  if (
    code === "too_many_requests" ||
    msg.includes("rate limit") ||
    msg.includes("too many") ||
    msg.includes("security purposes") ||
    msg.includes("email rate limit")
  ) {
    return "Too many attempts. Try again in a few minutes.";
  }
  return "Something went wrong. Please try again.";
}

function mapVerifyOtpError(error: AuthError): string {
  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();
  if (
    code === "otp_expired" ||
    msg.includes("expired") ||
    msg.includes("invalid") ||
    msg.includes("token")
  ) {
    return VERIFY_OTP_MISMATCH;
  }
  return VERIFY_OTP_MISMATCH;
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

export async function sendSignInOtpAction(input: {
  email: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmedEmail = input.email.trim();
  if (!trimmedEmail) {
    return { ok: false, error: "Email is required" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      return { ok: false, error: mapSignInOtpSendError(error) };
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

export async function verifySignInOtpAction(input: {
  email: string;
  token: string;
  next?: string;
}): Promise<{ ok: false; error: string } | never> {
  const email = input.email.trim();
  const token = input.token.replace(/\D/g, "");
  if (!email || token.length !== 8) {
    return { ok: false, error: VERIFY_OTP_MISMATCH };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return { ok: false, error: mapVerifyOtpError(error) };
  }

  revalidatePath("/", "layout");
  revalidatePath("/planner");
  redirect(safeNextPath(input.next));
}

export async function verifySignupOtpAction(input: {
  email: string;
  token: string;
}): Promise<{ ok: false; error: string } | never> {
  const email = input.email.trim();
  const token = input.token.replace(/\D/g, "");
  if (!email || token.length !== 8) {
    return { ok: false, error: VERIFY_OTP_MISMATCH };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "signup",
  });

  if (error) {
    return { ok: false, error: mapVerifyOtpError(error) };
  }

  revalidatePath("/", "layout");
  revalidatePath("/planner");
  redirect("/planner");
}

export async function verifyRecoveryOtpAction(input: {
  email: string;
  token: string;
}): Promise<{ ok: false; error: string } | never> {
  const email = input.email.trim();
  const token = input.token.replace(/\D/g, "");
  if (!email || token.length !== 8) {
    return { ok: false, error: VERIFY_OTP_MISMATCH };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });

  if (error) {
    return { ok: false, error: mapVerifyOtpError(error) };
  }

  revalidatePath("/", "layout");
  redirect("/reset-password");
}

export async function resendSignupOtpAction(input: {
  email: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = input.email.trim();
  if (!email) {
    return { ok: false, error: "Email is required" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      const msg = (error.message ?? "").toLowerCase();
      if (
        msg.includes("rate limit") ||
        msg.includes("too many") ||
        msg.includes("security purposes")
      ) {
        return { ok: false, error: "Too many attempts. Try again in a few minutes." };
      }
      return { ok: false, error: "Something went wrong. Please try again." };
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
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: input.password,
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
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(trimmed);
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
          "This session is invalid or has expired. Request a new reset code from the forgot password page.",
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
