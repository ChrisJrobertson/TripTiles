-- Trip budget line items + packing checklist + trip budget fields + profile temperature unit.

-- ---- trips: optional budget summary ----
alter table trips
  add column if not exists budget_target numeric(10, 2),
  add column if not exists budget_currency text default 'GBP';

-- ---- profiles: planner temperature display (°C vs °F) ----
alter table profiles
  add column if not exists temperature_unit text not null default 'c';

alter table profiles
  drop constraint if exists profiles_temperature_unit_check;

alter table profiles
  add constraint profiles_temperature_unit_check
  check (temperature_unit in ('c', 'f'));

-- ---- trip_budget_items ----
create table if not exists trip_budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  category text not null,
  label text not null,
  amount numeric(10, 2) not null,
  currency text not null default 'GBP',
  is_paid boolean not null default false,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_budget_items_category_check check (
    category in (
      'flights',
      'accommodation',
      'tickets',
      'dining',
      'transport',
      'insurance',
      'cruise',
      'shopping',
      'other'
    )
  )
);

create index if not exists trip_budget_items_trip_id_idx on trip_budget_items (trip_id);

alter table trip_budget_items enable row level security;

drop policy if exists "trip_budget_items_select_own" on trip_budget_items;
create policy "trip_budget_items_select_own"
  on trip_budget_items for select
  using (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

drop policy if exists "trip_budget_items_insert_own" on trip_budget_items;
create policy "trip_budget_items_insert_own"
  on trip_budget_items for insert
  with check (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

drop policy if exists "trip_budget_items_update_own" on trip_budget_items;
create policy "trip_budget_items_update_own"
  on trip_budget_items for update
  using (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  )
  with check (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

drop policy if exists "trip_budget_items_delete_own" on trip_budget_items;
create policy "trip_budget_items_delete_own"
  on trip_budget_items for delete
  using (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

-- ---- trip_checklist_items ----
create table if not exists trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  category text not null,
  label text not null,
  is_checked boolean not null default false,
  is_custom boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint trip_checklist_items_category_check check (
    category in (
      'packing_essentials',
      'packing_clothing',
      'packing_kids',
      'packing_tech',
      'before_you_go',
      'at_the_park'
    )
  )
);

create index if not exists trip_checklist_items_trip_id_idx on trip_checklist_items (trip_id);

alter table trip_checklist_items enable row level security;

drop policy if exists "trip_checklist_items_select_own" on trip_checklist_items;
create policy "trip_checklist_items_select_own"
  on trip_checklist_items for select
  using (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

drop policy if exists "trip_checklist_items_insert_own" on trip_checklist_items;
create policy "trip_checklist_items_insert_own"
  on trip_checklist_items for insert
  with check (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

drop policy if exists "trip_checklist_items_update_own" on trip_checklist_items;
create policy "trip_checklist_items_update_own"
  on trip_checklist_items for update
  using (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  )
  with check (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

drop policy if exists "trip_checklist_items_delete_own" on trip_checklist_items;
create policy "trip_checklist_items_delete_own"
  on trip_checklist_items for delete
  using (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );
