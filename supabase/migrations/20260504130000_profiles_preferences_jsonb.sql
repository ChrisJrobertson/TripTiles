-- Planner UX: persist AI day preview defaults and Mode A success counts in profile JSON (not localStorage).
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.preferences is
  'User-scoped UI and planner metadata (e.g. ai_day_preview_default, ai_day_plan_mode_a_success_count).';
