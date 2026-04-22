export type ParkMustDoTiming =
  | "rope_drop"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening";

/** Per-park ordered ride suggestions (AI-generated, stored in `trips.preferences.must_dos`). */
export type ParkMustDo = {
  id: string;
  title: string;
  timing: ParkMustDoTiming;
  why: string;
  done: boolean;
};

/** `preferences.must_dos[dateISO][parkId]` */
export type TripMustDosMap = Record<string, Record<string, ParkMustDo[]>>;
