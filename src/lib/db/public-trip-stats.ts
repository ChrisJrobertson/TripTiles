import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Fire-and-forget view counter for public plan pages (service role; ignores failures). */
export async function incrementPublicTripViewCount(
  slug: string,
): Promise<void> {
  const trimmed = slug.trim();
  if (!trimmed) return;
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("trips")
      .select("id, view_count")
      .eq("public_slug", trimmed)
      .eq("is_public", true)
      .maybeSingle();

    if (error || !data?.id) return;
    const row = data as { id: string; view_count?: number | null };
    const next = Number(row.view_count ?? 0) + 1;
    await admin.from("trips").update({ view_count: next }).eq("id", row.id);
  } catch {
    /* non-fatal */
  }
}
