-- Live wait times subsystem (Phase 1 — schema only).
-- Separate from static attractions catalogue; ingestion/API in later migrations.
--
-- Primary vocabulary: TripTiles live-wait product spec (internal, 2026-05-13).
--
-- Pre-flight (expect 0 rows each before first apply):
--   SELECT count(*) FROM live_wait_provider_mappings;
--   SELECT count(*) FROM live_wait_snapshots;
--   SELECT count(*) FROM live_wait_current;

-- ---------------------------------------------------------------------------
-- live_wait_provider_mappings
-- ---------------------------------------------------------------------------

create table if not exists public.live_wait_provider_mappings (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_park_id text not null default '',
  external_attraction_id text not null default '',
  park_id text references public.parks (id) on delete set null,
  attraction_id text references public.attractions (id) on delete set null,
  external_name text,
  mapping_confidence numeric(4, 3)
    check (mapping_confidence is null or (mapping_confidence >= 0 and mapping_confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_wait_provider_mappings_ext_unique
    unique (provider, external_park_id, external_attraction_id),
  constraint live_wait_provider_mappings_provider_nonempty
    check (length(trim(provider)) > 0)
);

comment on table public.live_wait_provider_mappings is
  'Maps external provider park/ride identifiers to TripTiles park_id and attraction_id for live wait ingestion.';
comment on column public.live_wait_provider_mappings.provider is
  'Ingestion source id (e.g. thrill_data, queue_times) — adapter-owned string.';
comment on column public.live_wait_provider_mappings.external_park_id is
  'Provider-native park identifier.';
comment on column public.live_wait_provider_mappings.external_attraction_id is
  'Provider-native ride/attraction identifier.';
comment on column public.live_wait_provider_mappings.mapping_confidence is
  'Optional 0–1 confidence for suggested or auto mappings.';

create index if not exists idx_live_wait_provider_mappings_provider_ext_attraction
  on public.live_wait_provider_mappings (provider, external_attraction_id);

create index if not exists idx_live_wait_provider_mappings_attraction_id
  on public.live_wait_provider_mappings (attraction_id)
  where attraction_id is not null;

drop trigger if exists live_wait_provider_mappings_updated_at on public.live_wait_provider_mappings;
create trigger live_wait_provider_mappings_updated_at
  before update on public.live_wait_provider_mappings
  for each row execute function public.update_updated_at();

alter table public.live_wait_provider_mappings enable row level security;

revoke all on public.live_wait_provider_mappings from anon, authenticated;
grant select, insert, update, delete on public.live_wait_provider_mappings to service_role;

-- ---------------------------------------------------------------------------
-- live_wait_snapshots (append-only history)
-- ---------------------------------------------------------------------------

create table if not exists public.live_wait_snapshots (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  park_id text references public.parks (id) on delete set null,
  attraction_id text references public.attractions (id) on delete set null,
  external_park_id text not null default '',
  external_attraction_id text not null default '',
  external_name text,
  wait_minutes integer
    check (wait_minutes is null or wait_minutes >= 0),
  operating_status text not null default 'unknown'
    check (
      operating_status in (
        'open',
        'closed',
        'temporarily_closed',
        'refurb',
        'down',
        'unknown'
      )
    ),
  is_open boolean not null default false,
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  constraint live_wait_snapshots_provider_nonempty
    check (length(trim(provider)) > 0)
);

comment on table public.live_wait_snapshots is
  'Historical live wait fetches; raw_payload retained for debugging and provider drift.';
comment on column public.live_wait_snapshots.observed_at is
  'Provider-reported observation time (wall clock as returned by adapter, UTC stored).';
comment on column public.live_wait_snapshots.fetched_at is
  'When TripTiles stored this row.';
comment on column public.live_wait_snapshots.raw_payload is
  'Unnormalised provider document for the row.';

create index if not exists idx_live_wait_snapshots_provider_ext_attraction
  on public.live_wait_snapshots (provider, external_attraction_id);

create index if not exists idx_live_wait_snapshots_attraction_observed
  on public.live_wait_snapshots (attraction_id, observed_at desc);

create index if not exists idx_live_wait_snapshots_park_observed
  on public.live_wait_snapshots (park_id, observed_at desc);

create index if not exists idx_live_wait_snapshots_fetched
  on public.live_wait_snapshots (fetched_at desc);

alter table public.live_wait_snapshots enable row level security;

revoke all on public.live_wait_snapshots from anon, authenticated;
grant select, insert, update, delete on public.live_wait_snapshots to service_role;

-- ---------------------------------------------------------------------------
-- live_wait_current (latest normalised row per provider external key)
-- ---------------------------------------------------------------------------

create table if not exists public.live_wait_current (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  park_id text references public.parks (id) on delete set null,
  attraction_id text references public.attractions (id) on delete set null,
  external_park_id text not null default '',
  external_attraction_id text not null default '',
  external_name text,
  wait_minutes integer
    check (wait_minutes is null or wait_minutes >= 0),
  operating_status text not null default 'unknown'
    check (
      operating_status in (
        'open',
        'closed',
        'temporarily_closed',
        'refurb',
        'down',
        'unknown'
      )
    ),
  is_open boolean not null default false,
  observed_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  stale_after timestamptz not null,
  raw_payload jsonb not null default '{}'::jsonb,
  constraint live_wait_current_provider_ext_unique
    unique (provider, external_park_id, external_attraction_id),
  constraint live_wait_current_provider_nonempty
    check (length(trim(provider)) > 0)
);

comment on table public.live_wait_current is
  'Latest normalised wait snapshot per provider external key; optimised for UI/API reads.';
comment on column public.live_wait_current.stale_after is
  'Advisory freshness horizon (e.g. observed_at + policy TTL). Past stale_after ⇒ treat as stale in UI.';
comment on column public.live_wait_current.raw_payload is
  'Latest raw provider payload for diagnostics; trim in API if needed.';

create index if not exists idx_live_wait_current_park_observed
  on public.live_wait_current (park_id, observed_at desc);

create index if not exists idx_live_wait_current_attraction_observed
  on public.live_wait_current (attraction_id, observed_at desc);

create index if not exists idx_live_wait_current_stale_after
  on public.live_wait_current (stale_after);

create index if not exists idx_live_wait_current_provider_fetched
  on public.live_wait_current (provider, fetched_at desc);

alter table public.live_wait_current enable row level security;

drop policy if exists "Anyone can read live_wait_current" on public.live_wait_current;
create policy "Anyone can read live_wait_current"
  on public.live_wait_current for select
  to authenticated, anon
  using (true);

revoke all on public.live_wait_current from anon, authenticated;
grant select on public.live_wait_current to anon, authenticated;
grant select, insert, update, delete on public.live_wait_current to service_role;

-- ---------------------------------------------------------------------------
-- Proof: CHECK constraints accept zero rows (vacuously true on empty tables)
-- ---------------------------------------------------------------------------
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.live_wait_snapshots'::regclass
-- ORDER BY conname;
