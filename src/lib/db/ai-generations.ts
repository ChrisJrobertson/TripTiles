import { createClient } from "@/lib/supabase/server";

/** Successful AI generations per trip (for free-tier limits). */
export async function getSuccessfulAiGenerationCountsForTrips(
  tripIds: string[],
): Promise<Record<string, number>> {
  if (tripIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_generations")
    .select("trip_id")
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
