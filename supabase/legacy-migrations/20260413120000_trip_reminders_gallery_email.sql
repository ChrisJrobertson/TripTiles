-- Trip milestone reminders, per-trip email opt-out, gallery owner label, profile marketing opt-out.

alter table public.trips
  add column if not exists email_reminders boolean not null default true;

alter table public.trips
  add column if not exists gallery_owner_label text;

alter table public.profiles
  add column if not exists email_marketing_opt_out boolean not null default false;

create table if not exists public.trip_reminders (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  days_before integer not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_id, days_before)
);

create index if not exists trip_reminders_trip_id_idx on public.trip_reminders (trip_id);
create index if not exists trip_reminders_sent_at_idx on public.trip_reminders (sent_at);

alter table public.trip_reminders enable row level security;

drop policy if exists "Trip reminders select own" on public.trip_reminders;
create policy "Trip reminders select own"
  on public.trip_reminders for select using (
    trip_id in (select id from public.trips where owner_id = (select auth.uid()))
  );

drop policy if exists "Trip reminders insert own" on public.trip_reminders;
create policy "Trip reminders insert own"
  on public.trip_reminders for insert with check (
    trip_id in (select id from public.trips where owner_id = (select auth.uid()))
  );

drop policy if exists "Trip reminders delete own" on public.trip_reminders;
create policy "Trip reminders delete own"
  on public.trip_reminders for delete using (
    trip_id in (select id from public.trips where owner_id = (select auth.uid()))
  );

grant select, insert, delete on public.trip_reminders to authenticated;
