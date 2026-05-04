import type { Attraction } from "@/types/attractions";

/** One ride row for day-strategy validation (heights match the attractions catalogue). */
export type RideConstraint = {
  name: string;
  min_height_cm: number | null;
};

export type ParkRideConstraints = {
  rides: RideConstraint[];
};

/** Build constraint rows from the same attraction list sent to the day-strategy model. */
export function buildParkRideConstraintsFromAttractions(
  attractions: Attraction[],
): ParkRideConstraints {
  return {
    rides: attractions.map((a) => ({
      name: a.name.trim(),
      min_height_cm:
        typeof a.height_requirement_cm === "number" &&
        Number.isFinite(a.height_requirement_cm)
          ? Math.round(a.height_requirement_cm)
          : null,
    })),
  };
}

const HEIGHT_IN_NAME_PATTERN = /^(.+?)\s*\(\s*min\s*(\d+)\s*cm\s*\)/i;

/**
 * If `ride_or_event` contains "(min NNN cm)", cross-check NNN against the catalogue
 * for this park's attractions. Fuzzy-matches ride names to catalogue entries.
 */
export function correctHeightInRideName(
  rideOrEvent: string,
  constraints: ParkRideConstraints | null,
): {
  corrected: string;
  wasChanged: boolean;
  detail?: string;
} {
  if (!constraints?.rides?.length) {
    return { corrected: rideOrEvent, wasChanged: false };
  }

  const match = rideOrEvent.match(HEIGHT_IN_NAME_PATTERN);
  if (!match) {
    return { corrected: rideOrEvent, wasChanged: false };
  }

  const rideName = match[1]!.trim();
  const claimedHeight = Number.parseInt(match[2]!, 10);
  if (!Number.isFinite(claimedHeight)) {
    return { corrected: rideOrEvent, wasChanged: false };
  }

  const sorted = [...constraints.rides].sort(
    (a, b) => b.name.length - a.name.length,
  );
  const matchedRide =
    sorted.find((r) => r.name.toLowerCase() === rideName.toLowerCase()) ??
    sorted.find(
      (r) =>
        rideName.toLowerCase().includes(r.name.toLowerCase()) ||
        r.name.toLowerCase().includes(rideName.toLowerCase()),
    );

  if (!matchedRide) {
    return { corrected: rideOrEvent, wasChanged: false };
  }

  const actualHeight = matchedRide.min_height_cm;
  const suffix = rideOrEvent.slice(match[0]!.length);

  if (actualHeight === null) {
    const corrected = `${matchedRide.name} (no min height)${suffix}`;
    if (corrected === rideOrEvent) {
      return { corrected: rideOrEvent, wasChanged: false };
    }
    return {
      corrected,
      wasChanged: true,
      detail: `claimed ${claimedHeight}cm but ride has no minimum`,
    };
  }

  if (Math.abs(claimedHeight - actualHeight) <= 2) {
    return { corrected: rideOrEvent, wasChanged: false };
  }

  const corrected = `${matchedRide.name} (min ${actualHeight} cm)${suffix}`;
  return {
    corrected,
    wasChanged: true,
    detail: `claimed ${claimedHeight}cm corrected to ${actualHeight}cm`,
  };
}
