export type DayTemplatePayload = {
  version: 1;
  assignments: {
    am?: string | { parkId: string; time?: string };
    pm?: string | { parkId: string; time?: string };
    lunch?: string | { parkId: string; time?: string };
    dinner?: string | { parkId: string; time?: string };
  };
  ridePriorities: Array<{
    attractionId: string | null;
    label?: string;
    priority: "must_do" | "if_time";
    sortOrder: number;
    notes?: string | null;
    /** 24h HH:mm, same as `trip_ride_priorities.skip_line_return_hhmm`. */
    skipLineReturnHhmm?: string | null;
    /** Pasted wait minutes; same as `trip_ride_priorities.pasted_queue_minutes`. */
    pastedQueueMinutes?: number | null;
  }>;
  dayNote?: string | null;
};

export type DayTemplateRow = {
  id: string;
  name: string;
  payload: DayTemplatePayload;
  is_seed: boolean;
  created_at: string;
};
