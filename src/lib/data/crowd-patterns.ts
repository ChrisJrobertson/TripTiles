/**
 * Relative crowd heuristics (0–10) for AI planning — not real-time data.
 * Update quarterly; treat as educated defaults, not ground truth.
 */

export type KnownEventImpact =
  | "closes_early"
  | "very_busy_fri_sat"
  | "extended_hours";

export type CrowdKnownEvent = {
  name: string;
  start_date: string;
  end_date: string;
  impact: KnownEventImpact;
  note: string;
};

export type DayOfWeekScores = {
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  sun: number;
};

export type MonthScores = {
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
};

export type CrowdPattern = {
  park_id: string;
  day_of_week_scores: DayOfWeekScores;
  month_scores: MonthScores;
  known_events: CrowdKnownEvent[];
  notes: string;
};

/** Seed rows keyed by stable slug (not always equal to DB `parks.id`). */
export const CROWD_PATTERNS_SEED: Record<
  string,
  Omit<CrowdPattern, "park_id">
> = {
  "magic-kingdom": {
    day_of_week_scores: {
      mon: 9,
      tue: 6,
      wed: 6,
      thu: 5,
      fri: 7,
      sat: 9,
      sun: 8,
    },
    month_scores: {
      jan: 3,
      feb: 5,
      mar: 7,
      apr: 6,
      may: 5,
      jun: 8,
      jul: 10,
      aug: 8,
      sep: 4,
      oct: 6,
      nov: 7,
      dec: 10,
    },
    known_events: [
      {
        name: "Mickey's Not-So-Scary Halloween Party",
        start_date: "2026-08-15",
        end_date: "2026-10-31",
        impact: "closes_early",
        note: "Park closes early on party nights — check hours",
      },
    ],
    notes:
      "Arrivals day skew: many families hit MK first, making Mondays heaviest. Avoid Saturdays if possible.",
  },
  epcot: {
    day_of_week_scores: {
      mon: 6,
      tue: 5,
      wed: 5,
      thu: 6,
      fri: 9,
      sat: 10,
      sun: 7,
    },
    month_scores: {
      jan: 3,
      feb: 5,
      mar: 7,
      apr: 7,
      may: 6,
      jun: 8,
      jul: 10,
      aug: 7,
      sep: 6,
      oct: 8,
      nov: 8,
      dec: 9,
    },
    known_events: [
      {
        name: "EPCOT International Food & Wine Festival",
        start_date: "2026-08-27",
        end_date: "2026-11-21",
        impact: "very_busy_fri_sat",
        note:
          "Friday and Saturday nights draw heavy local crowds — prefer Tue–Thu during the festival.",
      },
    ],
    notes:
      "Tuesday to Thursday are consistently the calmest days at EPCOT year-round.",
  },
  "hollywood-studios": {
    day_of_week_scores: {
      mon: 7,
      tue: 5,
      wed: 5,
      thu: 6,
      fri: 7,
      sat: 8,
      sun: 9,
    },
    month_scores: {
      jan: 3,
      feb: 5,
      mar: 7,
      apr: 7,
      may: 6,
      jun: 8,
      jul: 10,
      aug: 7,
      sep: 4,
      oct: 6,
      nov: 7,
      dec: 10,
    },
    known_events: [],
    notes:
      "Sunday spikes as fresh arrivals prioritise Galaxy's Edge. Wednesday and Thursday suit rope-drop on Rise.",
  },
  "animal-kingdom": {
    day_of_week_scores: {
      mon: 6,
      tue: 4,
      wed: 5,
      thu: 5,
      fri: 6,
      sat: 7,
      sun: 7,
    },
    month_scores: {
      jan: 3,
      feb: 4,
      mar: 6,
      apr: 5,
      may: 5,
      jun: 7,
      jul: 9,
      aug: 7,
      sep: 4,
      oct: 5,
      nov: 6,
      dec: 8,
    },
    known_events: [],
    notes:
      "Generally the quietest of the four WDW parks. Tuesdays are especially calm. Midday heat is rough Jul–Aug — rope drop and leave early.",
  },
  "universal-studios-florida": {
    day_of_week_scores: {
      mon: 6,
      tue: 6,
      wed: 6,
      thu: 6,
      fri: 8,
      sat: 10,
      sun: 9,
    },
    month_scores: {
      jan: 4,
      feb: 5,
      mar: 8,
      apr: 7,
      may: 5,
      jun: 8,
      jul: 10,
      aug: 7,
      sep: 4,
      oct: 7,
      nov: 6,
      dec: 8,
    },
    known_events: [
      {
        name: "Halloween Horror Nights",
        start_date: "2026-09-04",
        end_date: "2026-11-01",
        impact: "closes_early",
        note:
          "Park closes early on HHN nights — not suitable for young children.",
      },
    ],
    notes:
      "Weekends draw many annual passholders. Mid-week is usually better.",
  },
  "islands-of-adventure": {
    day_of_week_scores: {
      mon: 6,
      tue: 5,
      wed: 6,
      thu: 6,
      fri: 8,
      sat: 10,
      sun: 9,
    },
    month_scores: {
      jan: 4,
      feb: 5,
      mar: 8,
      apr: 7,
      may: 5,
      jun: 8,
      jul: 10,
      aug: 7,
      sep: 4,
      oct: 6,
      nov: 6,
      dec: 8,
    },
    known_events: [],
    notes:
      "Hagrid's and VelociCoaster sustain high waits most days — pair with USF on a Park-to-Park ticket mid-week when possible.",
  },
  "epic-universe": {
    day_of_week_scores: {
      mon: 8,
      tue: 8,
      wed: 8,
      thu: 8,
      fri: 9,
      sat: 10,
      sun: 9,
    },
    month_scores: {
      jan: 6,
      feb: 7,
      mar: 9,
      apr: 8,
      may: 7,
      jun: 9,
      jul: 10,
      aug: 8,
      sep: 6,
      oct: 7,
      nov: 7,
      dec: 9,
    },
    known_events: [],
    notes:
      "New-park demand stays high — expect busy weekdays too. Rope drop matters.",
  },
  "typhoon-lagoon": {
    day_of_week_scores: {
      mon: 5,
      tue: 5,
      wed: 5,
      thu: 5,
      fri: 7,
      sat: 9,
      sun: 8,
    },
    month_scores: {
      jan: 0,
      feb: 0,
      mar: 6,
      apr: 7,
      may: 8,
      jun: 10,
      jul: 10,
      aug: 9,
      sep: 7,
      oct: 5,
      nov: 0,
      dec: 0,
    },
    known_events: [],
    notes:
      "Often closed mid-winter / late fall for refurbishment — verify open dates. Prefer mid-week in summer.",
  },
};

/**
 * Maps planner / DB `parks.id` values to a key in {@link CROWD_PATTERNS_SEED}.
 * Extend as you add regions; unknown ids simply skip crowd data for that park.
 */
export const PARK_ID_TO_CROWD_KEY: Record<string, string> = {
  mk: "magic-kingdom",
  "magic-kingdom": "magic-kingdom",
  ep: "epcot",
  epcot: "epcot",
  dhs: "hollywood-studios",
  hs: "hollywood-studios",
  "hollywood-studios": "hollywood-studios",
  ak: "animal-kingdom",
  "animal-kingdom": "animal-kingdom",
  usf: "universal-studios-florida",
  "universal-studios-florida": "universal-studios-florida",
  ioa: "islands-of-adventure",
  "islands-of-adventure": "islands-of-adventure",
  eu: "epic-universe",
  epic: "epic-universe",
  "epic-universe": "epic-universe",
  tl: "typhoon-lagoon",
  "typhoon-lagoon": "typhoon-lagoon",
};

/** Crowd rows keyed by the same `park_id` strings used in assignments / prompts. */
export function getCrowdPatternsForParkIds(
  parkIds: string[],
): Record<string, CrowdPattern> {
  const out: Record<string, CrowdPattern> = {};
  for (const id of parkIds) {
    const slug =
      PARK_ID_TO_CROWD_KEY[id] ?? PARK_ID_TO_CROWD_KEY[id.toLowerCase()];
    if (!slug) continue;
    const base = CROWD_PATTERNS_SEED[slug];
    if (!base) continue;
    out[id] = { park_id: id, ...base };
  }
  return out;
}
