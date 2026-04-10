import { createClient } from "@/lib/supabase/server";
import type { Destination, Park } from "@/lib/types";

function mapPark(row: Record<string, unknown>): Park {
  const rawRegions = row.region_ids;
  const region_ids: string[] = Array.isArray(rawRegions)
    ? rawRegions.map(String)
    : [];

  return {
    id: String(row.id),
    name: String(row.name),
    icon: row.icon == null || row.icon === "" ? null : String(row.icon),
    bg_colour: String(
      row.bg_colour ?? (row as { bg_color?: string }).bg_color ?? "#333333",
    ),
    fg_colour: String(
      row.fg_colour ?? (row as { fg_color?: string }).fg_color ?? "#ffffff",
    ),
    park_group: String(row.park_group),
    destinations: Array.isArray(row.destinations)
      ? (row.destinations as Destination[])
      : [],
    region_ids,
    is_custom: Boolean(row.is_custom),
    sort_order: Number(row.sort_order ?? 100),
  };
}

export async function getAllParks(): Promise<Park[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parks")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => mapPark(r as Record<string, unknown>));
}

export async function getParksForRegion(regionId: string): Promise<Park[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parks")
    .select("*")
    .contains("region_ids", [regionId])
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => mapPark(r as Record<string, unknown>));
}
