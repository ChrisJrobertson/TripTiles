-- User-saved day templates (Navigator+). Seeds inserted on first API fetch.

create table if not exists public.trip_day_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  payload jsonb not null,
  is_seed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_day_templates_user_id_idx
  on public.trip_day_templates (user_id);

drop trigger if exists trip_day_templates_updated_at on public.trip_day_templates;
create trigger trip_day_templates_updated_at
  before update on public.trip_day_templates
  for each row execute function public.update_updated_at();

alter table public.trip_day_templates enable row level security;

drop policy if exists trip_day_templates_owner_select on public.trip_day_templates;
create policy trip_day_templates_owner_select
  on public.trip_day_templates for select
  using (user_id = (select auth.uid()));

drop policy if exists trip_day_templates_owner_insert on public.trip_day_templates;
create policy trip_day_templates_owner_insert
  on public.trip_day_templates for insert
  with check (user_id = (select auth.uid()));

drop policy if exists trip_day_templates_owner_update on public.trip_day_templates;
create policy trip_day_templates_owner_update
  on public.trip_day_templates for update
  using (user_id = (select auth.uid()));

drop policy if exists trip_day_templates_owner_delete on public.trip_day_templates;
create policy trip_day_templates_owner_delete
  on public.trip_day_templates for delete
  using (user_id = (select auth.uid()));
