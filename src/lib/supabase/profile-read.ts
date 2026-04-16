import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";
import type { UserTier } from "@/lib/types";

export type ProfileReadFailureReason =
  | "supabase_error"
  | "missing_row"
  | "missing_tier";

export type ProfileReadResult<Row extends Record<string, unknown>> =
  | { ok: true; data: Row }
  | {
      ok: false;
      reason: ProfileReadFailureReason;
      message: string;
      supabaseError?: PostgrestError;
    };

function reportProfileReadFailure(
  message: string,
  extra: Record<string, unknown>,
): void {
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureMessage(message, { level: "error", extra });
    })
    .catch(() => {
      if (process.env.NODE_ENV === "development") {
        console.error("[profile-read]", message, extra);
      }
    });
}

/**
 * Canonical server-side read of `profiles` for the signed-in user.
 * Checks `.error`, distinguishes empty rows from errors, and never defaults tier to "free".
 */
export async function readProfileRow<Row extends Record<string, unknown>>(
  supabase: SupabaseClient,
  userId: string,
  select: string,
): Promise<ProfileReadResult<Row>> {
  const { data, error } = await supabase
    .from("profiles")
    .select(select)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    reportProfileReadFailure("profiles select failed", {
      userId,
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      reason: "supabase_error",
      message: error.message,
      supabaseError: error,
    };
  }

  if (data === null || typeof data !== "object") {
    reportProfileReadFailure("profiles row missing", { userId });
    return {
      ok: false,
      reason: "missing_row",
      message: "No profile row for this account.",
    };
  }

  const row = data as Record<string, unknown>;
  if (
    !("tier" in row) ||
    row.tier === undefined ||
    row.tier === null ||
    typeof row.tier !== "string"
  ) {
    reportProfileReadFailure("profiles.tier missing or invalid", { userId });
    return {
      ok: false,
      reason: "missing_tier",
      message: "Profile tier is missing or invalid.",
    };
  }

  return { ok: true, data: data as Row };
}

export function tierFromProfileRow(row: { tier: string }): UserTier {
  return row.tier as UserTier;
}
