import { mapTripRow } from "@/lib/db/trips";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Trip } from "@/lib/types";

/** Read-only public trip for OG / cron (service role; server-only). */
export async function getPublicTripBySlugAdmin(
  slug: string,
): Promise<Trip | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("trips")
      .select("*")
      .eq("public_slug", trimmed)
      .eq("is_public", true)
      .maybeSingle();
    if (error || !data) return null;
    return mapTripRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}
