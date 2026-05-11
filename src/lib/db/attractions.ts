import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { mapAttractionRow } from "@/lib/ride-priority-rows";
import type { Attraction } from "@/types/attractions";
import { createClient } from "@supabase/supabase-js";

function createPublicCatalogueClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    throw new Error("Missing Supabase URL or anon key for attraction reads.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getAttractionsForParksPublic(
  parkIds: string[],
): Promise<Attraction[]> {
  const scopedParkIds = [...new Set(parkIds.map((id) => id.trim()).filter(Boolean))];
  if (scopedParkIds.length === 0) return [];

  const supabase = createPublicCatalogueClient();
  const { data, error } = await supabase
    .from("attractions")
    .select("*")
    .in("park_id", scopedParkIds)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapAttractionRow(row as Record<string, unknown>));
}
