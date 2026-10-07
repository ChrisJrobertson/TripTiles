-- Attractions catalogue + per-trip ride priorities (Session 12A)

do $$ begin
  create type ride_priority as enum ('must_do', 'if_time');
exception
  when duplicate_object then null;
end $$;

create table if not exists attractions (
  id text primary key,
  park_id text not null references parks (id),
  name text not null,
  category text not null default 'ride',
  height_requirement_cm integer,
  thrill_level text not null default 'moderate',
  is_indoor boolean not null default false,
  duration_minutes integer,
  skip_line_system text,
  skip_line_tier text,
  skip_line_notes text,
  avg_wait_peak_minutes integer,
  avg_wait_offpeak_minutes integer,
  best_time_to_ride text,
  sort_order integer not null default 0,
  is_seasonal boolean not null default false,
  is_temporarily_closed boolean not null default false,
  closure_note text,
  tags text[] not null default '{}'::text[],
  official_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attractions_category_check check (
    category in ('ride', 'show', 'character_meet', 'experience')
  ),
  constraint attractions_thrill_check check (
    thrill_level in ('gentle', 'moderate', 'thrilling', 'intense')
  )
);

create index if not exists idx_attractions_park_id on attractions (park_id);

drop trigger if exists attractions_updated_at on attractions;
create trigger attractions_updated_at
  before update on attractions
  for each row execute function update_updated_at();

alter table attractions enable row level security;

drop policy if exists "Anyone can read attractions" on attractions;
create policy "Anyone can read attractions"
  on attractions for select
  using (true);

create table if not exists trip_ride_priorities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  attraction_id text not null references attractions (id) on delete cascade,
  day_date date not null,
  priority ride_priority not null default 'must_do'::ride_priority,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (trip_id, attraction_id, day_date)
);

create index if not exists idx_trip_ride_priorities_trip_day
  on trip_ride_priorities (trip_id, day_date);

alter table trip_ride_priorities enable row level security;

drop policy if exists "Trip owner can manage ride priorities" on trip_ride_priorities;
create policy "Trip owner can manage ride priorities"
  on trip_ride_priorities for all
  using (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  )
  with check (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

drop policy if exists "Trip collaborators can manage ride priorities" on trip_ride_priorities;
create policy "Trip collaborators can manage ride priorities"
  on trip_ride_priorities for all
  using (
    trip_id in (
      select trip_id from trip_collaborators
      where user_id = (select auth.uid()) and status = 'accepted'
    )
  )
  with check (
    trip_id in (
      select trip_id from trip_collaborators
      where
        user_id = (select auth.uid())
        and status = 'accepted'
        and role = 'editor'
    )
  );

-- Allow anyone to read priorities on published trips (e.g. clone flow).
drop policy if exists "Public trips ride priorities are readable" on trip_ride_priorities;
create policy "Public trips ride priorities are readable"
  on trip_ride_priorities for select
  using (
    trip_id in (select id from trips where is_public = true)
  );
