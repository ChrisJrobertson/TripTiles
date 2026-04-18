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
