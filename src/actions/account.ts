"use server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateDisplayNameAction(input: {
  displayName: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const name = input.displayName.trim().slice(0, 120);
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name || null })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function exportUserDataAction(): Promise<
  { ok: true; json: string; filename: string } | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user || !user.email) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const uid = user.id;

  const [
    profileRes,
    tripsRes,
    tilesRes,
    achRes,
    purchasesRes,
    aiFirstRes,
    aiLastRes,
    aiCountRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("trips").select("*").eq("owner_id", uid),
    supabase.from("custom_tiles").select("*").eq("owner_id", uid),
    supabase.from("achievements").select("*").eq("user_id", uid),
    supabase.from("purchases").select("*").eq("user_id", uid),
    supabase
      .from("ai_generations")
      .select("id, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("ai_generations")
      .select("id, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid),
  ]);

  const exportedAt = new Date().toISOString();
  const payload = {
    exported_at: exportedAt,
    user: {
      id: uid,
      email: user.email,
      profile: profileRes.data ?? null,
    },
    trips: tripsRes.data ?? [],
    custom_tiles: tilesRes.data ?? [],
    achievements: achRes.data ?? [],
    purchases: (purchasesRes.data ?? []).map((p) => ({
      ...p,
      metadata: p.metadata ?? null,
    })),
    ai_generations_summary: {
      count: aiCountRes.count ?? 0,
      first: aiFirstRes.data?.[0] ?? null,
      last: aiLastRes.data?.[0] ?? null,
    },
  };

  const filename = `triptiles-data-${exportedAt.slice(0, 10)}.json`;
  return {
    ok: true,
    json: JSON.stringify(payload, null, 2),
    filename,
  };
}

export async function deleteAccountAction(input: {
  confirmationEmail: string;
}): Promise<{ ok: false; error: string } | never> {
  const user = await getCurrentUser();
  if (!user || !user.email) {
    return { ok: false, error: "Not signed in." };
  }
  if (input.confirmationEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Email does not match your account." };
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return { ok: false, error: error.message };
  }

  redirect("/?account_deleted=1");
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }

  const user = await getCurrentUser();
  if (!user?.email) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (signErr) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const { error: upErr } = await supabase.auth.updateUser({
    password: input.newPassword,
  });
  if (upErr) return { ok: false, error: upErr.message };

  revalidatePath("/settings");
  return { ok: true };
}
