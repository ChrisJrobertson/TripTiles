import { readPublicTripBySlug } from "@/lib/db/public-trip-read";
import type { Trip } from "@/lib/types";

/** Read-only public trip for OG / cron (service role; server-only). */
export async function getPublicTripBySlugAdmin(
  slug: string,
): Promise<Trip | null> {
  try {
    return await readPublicTripBySlug(slug);
  } catch {
    return null;
  }
}
