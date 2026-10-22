import { PUBLIC_TRIP_COLUMNS, toPublicTrip } from "@/lib/public-trip-contract";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Trip } from "@/lib/types";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUSTOM_TILE_ID = /^ct_[a-z0-9]{8,32}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type PublicTripServerRead = {
  trip: Trip;
  /** Server-side only. Never pass this to a client component. */
  ownerId: string;
};

function asRow(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

/**
 * Published trip for `/plans/[slug]`. Service role is required because anonymous
 * clients no longer have a SELECT policy on `trips`. The query filters
 * `is_public` and the slug, then returns the allowlisted projection.
 */
export async function readPublicTripBySlug(slug: string): Promise<Trip | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!SLUG.test(trimmed) || trimmed.length > 80) return null;
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("trips")
    .select(PUBLIC_TRIP_COLUMNS)
    .eq("public_slug", trimmed)
    .eq("is_public", true)
    .maybeSingle();
  if (error || !data) return null;
  const row = asRow(data);
  if (!row || row.is_public !== true) return null;
  return toPublicTrip(row);
}

/** Published trip looked up by id for clone. Returns null unless `is_public`. */
export async function readPublicTripById(
  tripId: string,
): Promise<PublicTripServerRead | null> {
  const id = tripId.trim().toLowerCase();
  if (!UUID.test(id)) return null;
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("trips")
    .select(`${PUBLIC_TRIP_COLUMNS},owner_id`)
    .eq("id", id)
    .eq("is_public", true)
    .maybeSingle();
  if (error || !data) return null;
  const row = asRow(data);
  if (!row || row.is_public !== true) return null;
  const ownerId = typeof row.owner_id === "string" ? row.owner_id.toLowerCase() : "";
  if (!UUID.test(ownerId)) return null;
  return { trip: toPublicTrip(row), ownerId };
}

/** Ids only, so a public clone can drop parks that belong to the publisher's library. */
export async function listOwnerCustomTileIds(ownerId: string): Promise<Set<string>> {
  if (!UUID.test(ownerId)) return new Set();
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("custom_tiles")
    .select("id")
    .eq("user_id", ownerId);
  if (error || !data) return new Set();
  const ids = data.flatMap((row) => {
    if (!row || typeof row !== "object" || !("id" in row)) return [];
    const id = String(row.id);
    return CUSTOM_TILE_ID.test(id) ? [id] : [];
  });
  return new Set(ids);
}
