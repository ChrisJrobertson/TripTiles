import { createClient } from "@/lib/supabase/server";
import type { Region } from "@/lib/types";

export async function getAllRegions(): Promise<Region[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Region[];
}

export async function getFeaturedRegions(): Promise<Region[]> {
  const all = await getAllRegions();
  return all.filter((r) => r.is_featured);
}

export async function getRegionById(id: string): Promise<Region | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Region;
}
