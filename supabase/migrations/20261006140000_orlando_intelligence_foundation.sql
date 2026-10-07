-- Orlando intelligence foundation.
--
-- Primary sources, verified 2026-10-06 and re-checked 2026-10-07:
--   ThemeParks.wiki HTTP API
--     https://www.themeparks.wiki/api
--     https://www.themeparks.wiki/api/http
--     https://www.themeparks.wiki/terms
--     GET https://api.themeparks.wiki/v1/destinations
--     GET https://api.themeparks.wiki/v1/entity/{id} for each mapped park
--     Free commercial use is allowed as a product input, not as a redistributed feed.
--     Visible “Powered by ThemeParks.wiki” credit is required on the free tier.
--     Do not imply ThemeParks.wiki data is official park/operator data.
--     Live responses carry Cache-Control max-age=60 and ETag; cron stays at 5 minutes.
--   Queue-Times parks.json (User-Agent TripTilesLiveWaitIngest/1.0)
--     https://queue-times.com/parks.json
--     Aquatica Orlando is id 94.
--     Discovery Cove is not in that index. Seed id 308 is not attached.
--
-- Pre-flight (run before apply; record the counts):
--   select id from public.parks
--   where id in (
--     'mk','ep','hs','ak','us','ioa','eu','sw','aq','dc','vb','tl','bb','ll','bg','ds'
--   )
--   order by id;
--   -- expect 16 rows
--   select count(*) as mappings_before from public.live_wait_park_mappings;
--   select count(*) as attractions_before from public.attractions;
--   select count(*) as parks_before from public.parks;
-- This migration does not update parks or attractions catalogue columns.
-- Attractions and parks row counts must match after apply.
--
-- CHECK proof after apply:
--   select count(*) as bad_park_match from public.live_wait_park_mappings
--   where match_status not in (
--     'confirmed_exact','manually_approved','legacy_unverified',
--     'candidate','missing','retired','ambiguous'
--   );
--   -- expect 0
--   select count(*) as invented_approvals from public.live_wait_park_mappings
--   where match_status = 'manually_approved'
--     and provider = 'queue_times'
--     and coalesce(notes, '') not ilike '%manual%';
--   -- expect 0 for rows that only gained match_status from this migration
--   select count(*) as bad_provenance from public.park_operating_schedules
--   where provenance_kind not in (
--     'OFFICIAL_FACT','PROVIDER_OBSERVATION','LIVE_OBSERVATION','HISTORICAL_OBSERVATION',
--     'DERIVED_CALCULATION','TRIPTILES_RULE','USER_INPUT','FALLBACK_ASSUMPTION'
--   );
--   -- expect 0
--   select count(*) as bad_times from public.park_operating_schedules
--   where (opens_at is not null and opens_at !~ '^(?:0\d|1\d|2\d|30):[0-5]\d$')
--      or (closes_at is not null and closes_at !~ '^(?:0\d|1\d|2\d|30):[0-5]\d$');
--   -- expect 0

alter table public.live_wait_park_mappings
  add column if not exists match_status text not null default 'legacy_unverified',
  add column if not exists notes text,
  add column if not exists timezone text,
  add column if not exists provider_latitude numeric,
  add column if not exists provider_longitude numeric;

alter table public.live_wait_provider_mappings
  add column if not exists match_status text not null default 'legacy_unverified',
  add column if not exists notes text;

-- Existing rows must not inherit a false human-approval claim.
alter table public.live_wait_park_mappings
  alter column match_status set default 'legacy_unverified';
alter table public.live_wait_provider_mappings
  alter column match_status set default 'legacy_unverified';

alter table public.live_wait_park_mappings
  drop constraint if exists live_wait_park_mappings_match_status_check;
alter table public.live_wait_park_mappings
  add constraint live_wait_park_mappings_match_status_check
  check (
    match_status in (
      'confirmed_exact',
      'manually_approved',
      'legacy_unverified',
      'candidate',
      'missing',
      'retired',
      'ambiguous'
    )
  );

alter table public.live_wait_provider_mappings
  drop constraint if exists live_wait_provider_mappings_match_status_check;
alter table public.live_wait_provider_mappings
  add constraint live_wait_provider_mappings_match_status_check
  check (
    match_status in (
      'confirmed_exact',
      'manually_approved',
      'legacy_unverified',
      'candidate',
      'missing',
      'retired',
      'ambiguous'
    )
  );

do $$
begin
  alter table public.live_wait_park_mappings
    add constraint live_wait_park_mappings_provider_latitude_check
    check (provider_latitude is null or (provider_latitude >= -90 and provider_latitude <= 90));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.live_wait_park_mappings
    add constraint live_wait_park_mappings_provider_longitude_check
    check (provider_longitude is null or (provider_longitude >= -180 and provider_longitude <= 180));
exception
  when duplicate_object then null;
end $$;

comment on column public.live_wait_park_mappings.match_status is
  'confirmed_exact and manually_approved are verified. legacy_unverified is operationally usable without claiming human approval. candidate, missing, retired, and ambiguous must not be auto-applied.';
comment on column public.live_wait_provider_mappings.match_status is
  'Same semantics as live_wait_park_mappings.match_status.';
comment on column public.live_wait_park_mappings.provider_latitude is
  'Provider-observed latitude. Do not copy onto parks.latitude.';
comment on column public.live_wait_park_mappings.provider_longitude is
  'Provider-observed longitude. Do not copy onto parks.longitude.';

-- Queue-Times id 94 is Aquatica Orlando. Fill only a null TripTiles park id.
update public.live_wait_park_mappings
set
  park_id = 'aq',
  match_status = 'confirmed_exact',
  notes = coalesce(
    notes,
    'Queue-Times parks.json fetched 2026-10-06 lists id 94 as Aquatica Orlando.'
  ),
  updated_at = now()
where provider = 'queue_times'
  and external_park_id = '94'
  and park_id is null
  and external_park_name = 'Aquatica Orlando';

insert into public.live_wait_park_mappings (
  park_id,
  provider,
  external_park_id,
  external_park_name,
  match_status,
  notes,
  timezone,
  provider_latitude,
  provider_longitude
)
values
  ('mk', 'themeparks_wiki', '75ea578a-adc8-4116-a54d-dccb60765ef9', 'Magic Kingdom Park', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Walt Disney World Resort.', 'America/New_York', 28.4160036778, -81.5811902834),
  ('ep', 'themeparks_wiki', '47f90d2c-e191-4239-a466-5892ef59a88b', 'EPCOT', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Walt Disney World Resort.', 'America/New_York', 28.3762301397, -81.5494047655),
  ('hs', 'themeparks_wiki', '288747d1-8b4f-4a64-867e-ea7c9b27bad8', 'Disney''s Hollywood Studios', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Walt Disney World Resort.', 'America/New_York', 28.3584111691, -81.558689232),
  ('ak', 'themeparks_wiki', '1c84a229-8862-4648-9c71-378ddd2c7693', 'Disney''s Animal Kingdom Theme Park', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Walt Disney World Resort.', 'America/New_York', 28.3553842507, -81.5900898529),
  ('us', 'themeparks_wiki', 'eb3f4560-2383-4a36-9152-6b3e5ed6bc57', 'Universal Studios Florida', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Universal Orlando Resort.', 'America/New_York', 28.477986, -81.468386),
  ('ioa', 'themeparks_wiki', '267615cc-8943-4c2a-ae2c-5da728ca591f', 'Universal Islands of Adventure', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Universal Orlando Resort.', 'America/New_York', 28.47225, -81.467594),
  ('eu', 'themeparks_wiki', '12dbb85b-265f-44e6-bccf-f1faa17211fc', 'Universal Epic Universe', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Universal Orlando Resort.', 'America/New_York', 28.4414454548964, -81.4486740912188),
  ('sw', 'themeparks_wiki', '27d64dee-d85e-48dc-ad6d-8077445cd946', 'SeaWorld Orlando', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. SeaWorld Parks and Resorts Orlando.', 'America/New_York', 28.4109798106776, -81.4609839717373),
  ('aq', 'themeparks_wiki', '9e2867f8-68eb-454f-b367-0ed0fd72d72a', 'Aquatica Orlando', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. SeaWorld Parks and Resorts Orlando.', 'America/New_York', 28.4157834490069, -81.4564001169188),
  ('dc', 'themeparks_wiki', '91f5c7f3-373b-42e1-9f24-f769e4a3f7da', 'Discovery Cove Orlando', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. SeaWorld Parks and Resorts Orlando. Queue-Times does not list this park.', 'America/New_York', 28.40508, -81.46361),
  ('vb', 'themeparks_wiki', 'fe78a026-b91b-470c-b906-9d2266b692da', 'Universal Volcano Bay', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Universal Orlando Resort.', 'America/New_York', 28.461355, -81.472286),
  ('tl', 'themeparks_wiki', 'b070cbc5-feaa-4b87-a8c1-f94cca037a18', 'Disney''s Typhoon Lagoon Water Park', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Walt Disney World Resort. Not in Queue-Times Disney group that day.', 'America/New_York', 28.3650541008, -81.5278921081),
  ('bb', 'themeparks_wiki', 'ead53ea5-22e5-4095-9a83-8c29300d7c63', 'Disney''s Blizzard Beach Water Park', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Walt Disney World Resort. Not in Queue-Times Disney group that day.', 'America/New_York', 28.3525184499, -81.5731637729),
  ('ll', 'themeparks_wiki', 'bb285952-7e52-4a07-a312-d0a1ed91a9ac', 'LEGOLAND Florida', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06.', 'America/New_York', 27.989351, -81.688977),
  ('bg', 'themeparks_wiki', 'fc40c99a-be0a-42f4-a483-1e939db275c2', 'Busch Gardens Tampa', 'confirmed_exact', 'GET /v1/destinations and /v1/entity on 2026-10-06. Busch Gardens Tampa destination.', 'America/New_York', 28.0374, -82.42144)
on conflict (provider, external_park_id) do update set
  park_id = coalesce(public.live_wait_park_mappings.park_id, excluded.park_id),
  external_park_name = excluded.external_park_name,
  timezone = coalesce(public.live_wait_park_mappings.timezone, excluded.timezone),
  provider_latitude = coalesce(public.live_wait_park_mappings.provider_latitude, excluded.provider_latitude),
  provider_longitude = coalesce(public.live_wait_park_mappings.provider_longitude, excluded.provider_longitude),
  notes = coalesce(public.live_wait_park_mappings.notes, excluded.notes),
  match_status = case
    when public.live_wait_park_mappings.match_status in ('confirmed_exact', 'manually_approved')
      then public.live_wait_park_mappings.match_status
    else excluded.match_status
  end,
  updated_at = now();

create table if not exists public.park_operating_schedules (
  id uuid primary key default gen_random_uuid(),
  park_id text references public.parks (id) on delete set null,
  provider text not null,
  external_park_id text not null,
  operating_date date not null,
  opens_at text,
  closes_at text,
  schedule_kind text not null,
  schedule_key text not null,
  timezone text,
  provenance_kind text not null default 'PROVIDER_OBSERVATION',
  observed_at timestamptz,
  fetched_at timestamptz not null default now(),
  stale_after timestamptz,
  confidence numeric(4, 3),
  description text,
  raw_payload jsonb not null default '{}'::jsonb,
  constraint park_operating_schedules_provider_nonempty
    check (length(trim(provider)) > 0),
  constraint park_operating_schedules_kind_check
    check (schedule_kind in ('operating', 'early_entry', 'extra_hours', 'special', 'closed')),
  constraint park_operating_schedules_provenance_check
    check (
      provenance_kind in (
        'OFFICIAL_FACT',
        'PROVIDER_OBSERVATION',
        'LIVE_OBSERVATION',
        'HISTORICAL_OBSERVATION',
        'DERIVED_CALCULATION',
        'TRIPTILES_RULE',
        'USER_INPUT',
        'FALLBACK_ASSUMPTION'
      )
    ),
  constraint park_operating_schedules_opens_at_check
    check (opens_at is null or opens_at ~ '^(?:0\d|1\d|2\d|30):[0-5]\d$'),
  constraint park_operating_schedules_closes_at_check
    check (closes_at is null or closes_at ~ '^(?:0\d|1\d|2\d|30):[0-5]\d$'),
  constraint park_operating_schedules_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint park_operating_schedules_unique
    unique (provider, external_park_id, operating_date, schedule_key)
);

-- Idempotent repair if an earlier draft created the table with weaker checks.
alter table public.park_operating_schedules
  alter column provenance_kind set default 'PROVIDER_OBSERVATION';
alter table public.park_operating_schedules
  drop constraint if exists park_operating_schedules_provenance_check;
alter table public.park_operating_schedules
  add constraint park_operating_schedules_provenance_check
  check (
    provenance_kind in (
      'OFFICIAL_FACT',
      'PROVIDER_OBSERVATION',
      'LIVE_OBSERVATION',
      'HISTORICAL_OBSERVATION',
      'DERIVED_CALCULATION',
      'TRIPTILES_RULE',
      'USER_INPUT',
      'FALLBACK_ASSUMPTION'
    )
  );
alter table public.park_operating_schedules
  drop constraint if exists park_operating_schedules_opens_at_check;
alter table public.park_operating_schedules
  add constraint park_operating_schedules_opens_at_check
  check (opens_at is null or opens_at ~ '^(?:0\d|1\d|2\d|30):[0-5]\d$');
alter table public.park_operating_schedules
  drop constraint if exists park_operating_schedules_closes_at_check;
alter table public.park_operating_schedules
  add constraint park_operating_schedules_closes_at_check
  check (closes_at is null or closes_at ~ '^(?:0\d|1\d|2\d|30):[0-5]\d$');

comment on table public.park_operating_schedules is
  'Date-specific posted park hours from providers. Not first-party unless provenance_kind is OFFICIAL_FACT. Does not overwrite parks.opens_at. Hours past midnight use 24:00–30:00.';

create index if not exists idx_park_operating_schedules_park_date
  on public.park_operating_schedules (park_id, operating_date);

alter table public.park_operating_schedules enable row level security;

drop policy if exists "Anyone can read park_operating_schedules" on public.park_operating_schedules;
create policy "Anyone can read park_operating_schedules"
  on public.park_operating_schedules for select
  to anon, authenticated
  using (true);

revoke all on public.park_operating_schedules from anon, authenticated;
grant select on public.park_operating_schedules to anon, authenticated;
grant select, insert, update, delete on public.park_operating_schedules to service_role;

create table if not exists public.provider_fetch_log (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  park_id text,
  external_park_id text,
  operation text not null,
  ok boolean not null,
  fetched_count integer,
  mapped_count integer,
  unmapped_count integer,
  observations_written integer,
  stale_count integer,
  error_message text,
  duration_ms integer,
  fetched_at timestamptz not null default now(),
  constraint provider_fetch_log_provider_nonempty
    check (length(trim(provider)) > 0),
  constraint provider_fetch_log_operation_check
    check (operation in ('live', 'schedule', 'destinations'))
);

comment on table public.provider_fetch_log is
  'Operational ingest log. Do not store API keys, service-role keys, or user payloads.';

create index if not exists idx_provider_fetch_log_provider_fetched
  on public.provider_fetch_log (provider, fetched_at desc);

alter table public.provider_fetch_log enable row level security;

revoke all on public.provider_fetch_log from anon, authenticated;
grant select, insert, update, delete on public.provider_fetch_log to service_role;
