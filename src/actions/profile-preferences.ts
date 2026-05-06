"use server";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { TemperatureUnit } from "@/lib/types";
import { revalidatePath } from "next/cache";

function normaliseProfilePreferences(
  raw: unknown,
): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export async function updateProfileTemperatureUnitAction(
  unit: TemperatureUnit,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (unit !== "c" && unit !== "f") return { ok: false, error: "Invalid unit." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ temperature_unit: unit })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings", "layout");
  revalidatePath("/planner");
  return { ok: true };
}

export async function updateProfileEmailMarketingOptOutAction(
  optOut: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ email_marketing_opt_out: optOut })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings", "layout");
  revalidatePath("/planner");
  return { ok: true };
}

/** JSON keys: `ai_day_preview_default`, `ai_day_plan_mode_a_success_count`, etc. */
export async function getProfilePlannerPreferencesAction(): Promise<
  { ok: true; preferences: Record<string, unknown> } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    preferences: normaliseProfilePreferences(data?.preferences),
  };
}

export async function setProfileAiDayPreviewDefaultAction(
  value: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { data, error: readErr } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  const prefs = normaliseProfilePreferences(data?.preferences);
  const next = { ...prefs, ai_day_preview_default: value };
  const { error } = await supabase
    .from("profiles")
    .update({ preferences: next })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/planner");
  revalidatePath("/settings", "layout");
  return { ok: true };
}

export async function incrementProfileAiDayPlanModeASuccessCountAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { data, error: readErr } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  const prefs = normaliseProfilePreferences(data?.preferences);
  const prev = prefs.ai_day_plan_mode_a_success_count;
  const n =
    typeof prev === "number" && Number.isFinite(prev)
      ? prev + 1
      : 1;
  const next = { ...prefs, ai_day_plan_mode_a_success_count: n };
  const { error } = await supabase
    .from("profiles")
    .update({ preferences: next })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/planner");
  return { ok: true };
}
