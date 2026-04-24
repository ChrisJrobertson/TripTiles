import type { Park } from "@/lib/types";
import type { TripRidePriority } from "@/types/attractions";

export type BookingAnchor = {
  rideId: string;
  attractionId: string;
  rideName: string;
  returnTimeHhmm: string;
  parkName: string;
  attractionParkId: string;
};

function parkName(
  parkId: string,
  parkById: ReadonlyMap<string, Park>,
): string {
  return parkById.get(parkId)?.name ?? parkId;
}

export function collectBookingAnchors(
  dayRows: TripRidePriority[],
  parkById: ReadonlyMap<string, Park>,
): BookingAnchor[] {
  const out: BookingAnchor[] = [];
  for (const r of dayRows) {
    const t = r.skip_line_return_hhmm?.trim();
    if (!t || !r.attraction) continue;
    const pid = r.attraction.park_id;
    out.push({
      rideId: r.id,
      attractionId: r.attraction_id,
      rideName: r.attraction.name,
      returnTimeHhmm: t,
      parkName: parkName(pid, parkById),
      attractionParkId: pid,
    });
  }
  return out;
}

/**
 * When replacing a slot’s park: strand risk if the slot previously held a park
 * that matches an anchor’s ride, and the new park is different.
 */
export function anchorsAtRiskOnSlotParkChange(
  oldParkId: string | undefined,
  newParkId: string,
  dayRows: TripRidePriority[],
  parkById: ReadonlyMap<string, Park>,
): BookingAnchor[] {
  if (!oldParkId) return [];
  return collectBookingAnchors(dayRows, parkById).filter(
    (a) => a.attractionParkId === oldParkId && newParkId !== a.attractionParkId,
  );
}

/**
 * When clearing a slot: risk if the cleared park is where a booked return lives.
 */
export function anchorsAtRiskOnSlotClear(
  oldParkId: string | undefined,
  dayRows: TripRidePriority[],
  parkById: ReadonlyMap<string, Park>,
): BookingAnchor[] {
  if (!oldParkId) return [];
  return collectBookingAnchors(dayRows, parkById).filter(
    (a) => a.attractionParkId === oldParkId,
  );
}

export function anchorForRideRemoval(
  row: TripRidePriority,
  parkById: ReadonlyMap<string, Park>,
): BookingAnchor | null {
  if (!row.skip_line_return_hhmm?.trim() || !row.attraction) return null;
  const pid = row.attraction.park_id;
  return {
    rideId: row.id,
    attractionId: row.attraction_id,
    rideName: row.attraction.name,
    returnTimeHhmm: row.skip_line_return_hhmm.trim(),
    parkName: parkName(pid, parkById),
    attractionParkId: pid,
  };
}

/**
 * `merge='replace'` on duplicate/template wipes ride rows for the target day.
 */
export function anchorsOnTargetDay(
  dayRows: TripRidePriority[],
  parkById: ReadonlyMap<string, Park>,
): BookingAnchor[] {
  return collectBookingAnchors(dayRows, parkById);
}
