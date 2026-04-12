"use server";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { TemperatureUnit } from "@/lib/types";
import { revalidatePath } from "next/cache";

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
  revalidatePath("/settings");
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
  revalidatePath("/settings");
  revalidatePath("/planner");
  return { ok: true };
}
