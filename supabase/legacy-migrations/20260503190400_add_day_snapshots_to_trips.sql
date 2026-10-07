alter table trips
  add column if not exists day_snapshots jsonb not null default '[]'::jsonb;

comment on column trips.day_snapshots is
  'Last 3 day-scoped AI changes per trip. Each entry: {date, before: {assignments_for_day, preferences_subset}, after, model, created_at, source}.';
