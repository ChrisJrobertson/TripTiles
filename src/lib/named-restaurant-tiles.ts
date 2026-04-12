import type { Park } from "@/lib/types";

/** Named chain tiles use sort_order ≥ this; generic dining tiles stay below. */
export const NAMED_DINING_TILE_ORDER_THRESHOLD = 900;

export function isNamedRestaurantPark(
  p: Pick<Park, "park_group" | "sort_order">,
): boolean {
  return (
    p.park_group === "dining" && p.sort_order >= NAMED_DINING_TILE_ORDER_THRESHOLD
  );
}
