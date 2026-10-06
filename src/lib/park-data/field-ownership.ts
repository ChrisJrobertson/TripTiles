/**
 * Who may write a planning field.
 *
 * Provider ingestion may refresh operational fields. It must not overwrite
 * curated TripTiles catalogue fields because a provider returned a value.
 */

export type FieldOwner = "provider" | "catalogue" | "user" | "derived";

export type FieldOwnership = {
  owner: FieldOwner;
  providerMayOverwrite: boolean;
  note: string;
};

export const FIELD_OWNERSHIP = {
  live_wait_minutes: {
    owner: "provider",
    providerMayOverwrite: true,
    note: "Latest operational wait. A missing wait stays null and is not stored as zero.",
  },
  operating_status: {
    owner: "provider",
    providerMayOverwrite: true,
    note: "Ride operating status from the live provider.",
  },
  park_schedule: {
    owner: "provider",
    providerMayOverwrite: true,
    note: "Date-specific posted hours live in park_operating_schedules, not parks.opens_at.",
  },
  thrill_level: {
    owner: "catalogue",
    providerMayOverwrite: false,
    note: "TripTiles thrill classification is editorial.",
  },
  tags: {
    owner: "catalogue",
    providerMayOverwrite: false,
    note: "Editorial tags and family-suitability markers stay on the catalogue.",
  },
  descriptions: {
    owner: "catalogue",
    providerMayOverwrite: false,
    note: "User-facing copy is TripTiles catalogue data.",
  },
  planning_weights: {
    owner: "catalogue",
    providerMayOverwrite: false,
    note: "Internal planning weights and skip-line strategy notes are TripTiles rules.",
  },
  height_requirement_cm: {
    owner: "catalogue",
    providerMayOverwrite: false,
    note: "Catalogue height wins whenever it is non-null. This phase does not auto-fill null heights from a provider.",
  },
  latitude: {
    owner: "catalogue",
    providerMayOverwrite: false,
    note: "parks.latitude stays catalogue-owned. Provider coordinates are stored on the provider mapping as evidence.",
  },
  longitude: {
    owner: "catalogue",
    providerMayOverwrite: false,
    note: "parks.longitude stays catalogue-owned. Provider coordinates are stored on the provider mapping as evidence.",
  },
} as const satisfies Record<string, FieldOwnership>;

export type OwnedField = keyof typeof FIELD_OWNERSHIP;

export function providerMayOverwrite(field: OwnedField): boolean {
  return FIELD_OWNERSHIP[field].providerMayOverwrite;
}
