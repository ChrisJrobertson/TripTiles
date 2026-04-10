import { createClient } from "@/lib/supabase/server";
import type { CustomTile } from "@/lib/types";

export async function getUserCustomTiles(userId: string): Promise<CustomTile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_tiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CustomTile[];
}

export async function getCustomTilesForRegion(
  userId: string,
  regionId: string,
): Promise<CustomTile[]> {
  const all = await getUserCustomTiles(userId);
  return all.filter(
    (t) => t.save_to_library || (t.region_ids?.includes(regionId) ?? false),
  );
}

export async function getCustomTileLimit(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("user_custom_tile_limit", {
    uid: userId,
  });
  if (error) throw error;
  return data as number;
}
