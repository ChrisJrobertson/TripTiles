-- Park-level Queue-Times ↔ TripTiles linkage (ride-level mappings stay in live_wait_provider_mappings).
--
-- Pre-flight: expect 0 rows before first apply:
--   select count(*) from public.live_wait_park_mappings;

-- TripTiles catalogue row for Holiday Park / Plopsaland Deutschland (Queue-Times id 302).
insert into public.parks (
  id,
  name,
  icon,
  bg_colour,
  fg_colour,
  park_group,
  destinations,
  region_ids,
  sort_order
)
select
  'plopsde',
  'Plopsaland Deutschland (Holiday Park)',
  null,
  '#FF69B4',
  '#FFFFFF',
  'attractions',
  array['custom']::destination[],
  array['germany'],
  226
where not exists (select 1 from public.parks where id = 'plopsde');

create table if not exists public.live_wait_park_mappings (
  id uuid primary key default gen_random_uuid(),
  park_id text references public.parks (id) on delete set null,
  provider text not null,
  external_park_id text not null,
  external_park_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_wait_park_mappings_provider_nonempty
    check (length(trim(provider)) > 0),
  constraint live_wait_park_mappings_ext_nonempty
    check (length(trim(external_park_id)) > 0),
  constraint live_wait_park_mappings_provider_ext_unique
    unique (provider, external_park_id)
);

comment on table public.live_wait_park_mappings is
  'Maps TripTiles parks.id to Queue-Times park ids for live wait ingestion and diagnostics.';

comment on column public.live_wait_park_mappings.external_park_id is
  'Queue-Times park id (numeric id from parks.json, stored as text).';

create index if not exists idx_live_wait_park_mappings_park
  on public.live_wait_park_mappings (park_id)
  where park_id is not null;

drop trigger if exists live_wait_park_mappings_updated_at on public.live_wait_park_mappings;
create trigger live_wait_park_mappings_updated_at
  before update on public.live_wait_park_mappings
  for each row execute function public.update_updated_at();

alter table public.live_wait_park_mappings enable row level security;

revoke all on public.live_wait_park_mappings from anon, authenticated;
grant select, insert, update, delete on public.live_wait_park_mappings to service_role;
