
create table trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  agency_id uuid references agencies(id) on delete set null,
  family_name text not null default 'My Family',
  adventure_name text not null default 'A Magical Adventure',
  destination destination not null default 'orlando',
  status trip_status not null default 'planning',
  start_date date not null,
  end_date date not null,
  has_cruise boolean default false,
  cruise_embark date,
  cruise_disembark date,
  cruise_line text,
  ship_name text,
  adults int default 2,
  children int default 0,
  child_ages int[] default array[]::int[],
  total_budget_gbp int,
  preferences jsonb default '{}'::jsonb,
  assignments jsonb not null default '{}'::jsonb,
  custom_parks jsonb default '{}'::jsonb,
  notes text,
  is_public boolean default false,
  public_slug text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_opened_at timestamptz default now()
);

create index idx_trips_owner on trips(owner_id);
create index idx_trips_agency on trips(agency_id) where agency_id is not null;
create index idx_trips_dates on trips(start_date, end_date);
create index idx_trips_public on trips(is_public) where is_public = true;
create index idx_trips_slug on trips(public_slug) where public_slug is not null;

create trigger trips_updated_at before update on trips
  for each row execute function update_updated_at();
;
