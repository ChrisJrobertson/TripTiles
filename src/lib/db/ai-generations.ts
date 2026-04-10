import { createClient } from "@/lib/supabase/server";

/** Successful AI generations per trip (for free-tier limits and UI). */
export async function getSuccessfulAiGenerationCountsForTrips(
  tripIds: string[],
  userId: string,
): Promise<Record<string, number>> {
  if (tripIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_generations")
    .select("trip_id")
    .eq("user_id", userId)
    .eq("success", true)
    .in("trip_id", tripIds);

  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const id of tripIds) counts[id] = 0;
  for (const row of data ?? []) {
    const tid = (row as { trip_id: string }).trip_id;
    counts[tid] = (counts[tid] ?? 0) + 1;
  }
  return counts;
}

/** Exact successful generation count for one trip (after logging a run). */
export async function getSuccessfulAiGenerationCountForTrip(
  tripId: string,
  userId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("ai_generations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("trip_id", tripId)
    .eq("success", true);

  if (error) throw error;
  return count ?? 0;
}
