-- Park alignment data infrastructure: audit tables, import batch log,
-- briefing storage, and completeness views (additive; does not modify seed rows).

-- ---------------------------------------------------------------------------
-- import_batches: one row per import run (dry-run or apply)
-- ---------------------------------------------------------------------------
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  script_name text not null,
  file_path text,
  file_sha256 text,
  dry_run boolean not null default true,
  applied_by text,
  git_sha text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_ok integer not null default 0,
  rows_err integer not null default 0,
  meta jsonb not null default '{}'::jsonb
);

comment on table public.import_batches is
  'Append-only log for CSV alignment imports; written by service-role scripts only.';

alter table public.import_batches enable row level security;

-- No policies: authenticated/anon cannot read/write; service role bypasses RLS.

create index if not exists idx_import_batches_started
  on public.import_batches (started_at desc);

-- ---------------------------------------------------------------------------
-- park_areas: sourced land/area labels (no geometry — names only)
-- ---------------------------------------------------------------------------
create table if not exists public.park_areas (
  id uuid primary key default gen_random_uuid(),
  park_id text not null references public.parks (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  source_url text not null,
  source_date date not null,
  created_at timestamptz not null default now(),
  constraint park_areas_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists idx_park_areas_park_name_lower
  on public.park_areas (park_id, lower(trim(name)));

create index if not exists idx_park_areas_park_id on public.park_areas (park_id);

alter table public.park_areas enable row level security;

create policy "Anyone can read park_areas"
  on public.park_areas for select
  to authenticated, anon
  using (true);

-- ---------------------------------------------------------------------------
-- region_briefings / park_briefings: sourced prose for operators & future AI
-- ---------------------------------------------------------------------------
create table if not exists public.region_briefings (
  id uuid primary key default gen_random_uuid(),
  region_id text not null references public.regions (id) on delete cascade,
  locale text not null default 'en',
  body text not null,
  source_url text not null,
  source_date date not null,
  supersedes_id uuid references public.region_briefings (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint region_briefings_body_nonempty check (length(trim(body)) > 0)
);

create index if not exists idx_region_briefings_region
  on public.region_briefings (region_id, created_at desc);

alter table public.region_briefings enable row level security;

create policy "Anyone can read region_briefings"
  on public.region_briefings for select
  to authenticated, anon
  using (true);

create table if not exists public.park_briefings (
  id uuid primary key default gen_random_uuid(),
  park_id text not null references public.parks (id) on delete cascade,
  locale text not null default 'en',
  body text not null,
  source_url text not null,
  source_date date not null,
  supersedes_id uuid references public.park_briefings (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint park_briefings_body_nonempty check (length(trim(body)) > 0)
);

create index if not exists idx_park_briefings_park
  on public.park_briefings (park_id, created_at desc);

alter table public.park_briefings enable row level security;

create policy "Anyone can read park_briefings"
  on public.park_briefings for select
  to authenticated, anon
  using (true);

-- ---------------------------------------------------------------------------
-- Completeness: one row per (region_id, park_id) for built-in parks
-- ---------------------------------------------------------------------------
create or replace view public.park_alignment_completeness as
with pr as (
  select
    p.id as park_id,
    rid::text as region_id
  from public.parks p
  cross join lateral unnest(p.region_ids) as rid
  where coalesce(p.is_custom, false) = false
),
attr as (
  select
    park_id,
    count(*)::int as attraction_count,
    sum(
      case
        when a.skip_line_system is not null and length(trim(a.skip_line_system)) > 0
        then 1
        else 0
      end
    )::int as attractions_with_skip_line
  from public.attractions a
  group by park_id
),
area_c as (
  select park_id, count(*)::int as area_count
  from public.park_areas
  group by park_id
),
rb as (
  select region_id, count(*)::int as region_briefing_count
  from public.region_briefings
  group by region_id
),
pb as (
  select park_id, count(*)::int as park_briefing_count
  from public.park_briefings
  group by park_id
),
rsl as (
  select region_id, count(*)::int as region_skip_line_rows
  from public.region_skip_line_systems
  group by region_id
),
rsl_non_none as (
  select region_id, count(*)::int as cnt
  from public.region_skip_line_systems
  where skip_line_system_id is distinct from 'none'
  group by region_id
),
core as (
  select
    pr.region_id,
    pr.park_id,
    r.name as region_name,
    p.name as park_name,
    r.data_quality_tier,
    case
      when p.country is not null and length(trim(p.country)) > 0 then true
      else false
    end as has_park_country,
    case
      when p.latitude is not null and p.longitude is not null then true
      else false
    end as has_coordinates,
    case
      when p.official_url is not null and length(trim(p.official_url)) > 0 then true
      else false
    end as has_official_url,
    case
      when coalesce(p.hours_known, false)
        and p.opens_at is not null
        and p.closes_at is not null
      then true
      else false
    end as has_opening_hours,
    case
      when coalesce(ac.area_count, 0) > 0 then true
      else false
    end as has_park_areas,
    case
      when coalesce(at.attraction_count, 0) > 0 then true
      else false
    end as has_attractions,
    case
      when coalesce(rnn.cnt, 0) = 0 then true
      when coalesce(at.attraction_count, 0) = 0 then false
      when coalesce(at.attractions_with_skip_line, 0) = coalesce(at.attraction_count, 0)
      then true
      else false
    end as skip_line_catalogue_ok,
    case
      when coalesce(rb.region_briefing_count, 0) > 0 then true
      else false
    end as has_region_briefing,
    case
      when coalesce(pb.park_briefing_count, 0) > 0 then true
      else false
    end as has_park_briefing,
    coalesce(at.attraction_count, 0) as attraction_count
  from pr
  join public.parks p on p.id = pr.park_id
  join public.regions r on r.id = pr.region_id
  left join attr at on at.park_id = p.id
  left join area_c ac on ac.park_id = p.id
  left join rb on rb.region_id = pr.region_id
  left join pb on pb.park_id = p.id
  left join rsl_non_none rnn on rnn.region_id = pr.region_id
),
scored as (
  select
    c.*,
    (
      (case when c.has_park_country then 5 else 0 end)
      + (case when c.has_coordinates then 15 else 0 end)
      + (case when c.has_official_url then 15 else 0 end)
      + (case when c.has_opening_hours then 15 else 0 end)
      + (case when c.has_park_areas then 10 else 0 end)
      + (case when c.has_attractions then 20 else 0 end)
      + (case when c.skip_line_catalogue_ok then 10 else 0 end)
      + (case when c.has_region_briefing then 5 else 0 end)
      + (case when c.has_park_briefing then 5 else 0 end)
    )::numeric(6, 2) as completeness_score,
    (
      c.attraction_count = 0
      or (
        not c.has_official_url
        and not c.has_opening_hours
      )
    ) as is_launch_blocker
  from core c
)
select
  s.region_id,
  s.park_id,
  s.region_name,
  s.park_name,
  s.data_quality_tier,
  s.has_park_country,
  s.has_coordinates,
  s.has_official_url,
  s.has_opening_hours,
  s.has_park_areas,
  s.has_attractions,
  s.skip_line_catalogue_ok,
  s.has_region_briefing,
  s.has_park_briefing,
  s.attraction_count,
  s.completeness_score,
  s.is_launch_blocker,
  case
    when s.is_launch_blocker then 'blocked'
    when s.completeness_score >= 95 then 'complete'
    when s.completeness_score >= 80 then 'launch_ready'
    when s.completeness_score >= 50 then 'fallback_ready'
    else 'blocked'
  end as readiness,
  case
    when s.is_launch_blocker then 'Launch blocker: add attractions and/or official URL or opening hours.'
    when s.completeness_score >= 95 then 'Complete for current scoring weights.'
    when not s.has_coordinates then 'Next: import park-metadata (coordinates).'
    when not s.has_official_url then 'Next: import park-metadata (official_url).'
    when not s.has_opening_hours then 'Next: import park-hours.'
    when not s.has_park_areas then 'Next: import park-areas.'
    when not s.has_attractions then 'Next: import attractions.'
    when not s.skip_line_catalogue_ok then 'Next: import skip-line-mapping for attractions.'
    when not s.has_region_briefing then 'Next: import region-briefings.'
    when not s.has_park_briefing then 'Next: import park-briefings.'
    else 'Next: raise score with remaining dimensions.'
  end as next_action_hint
from scored s;

comment on view public.park_alignment_completeness is
  'Per (region_id, built-in park_id) alignment flags, 0–100 score, readiness, and hint.';

create or replace view public.region_alignment_rollup as
select
  c.region_id,
  max(c.region_name) as region_name,
  max(c.data_quality_tier) as data_quality_tier,
  count(*)::int as park_rows,
  sum(case when c.readiness = 'complete' then 1 else 0 end)::int as parks_complete,
  sum(case when c.readiness = 'blocked' then 1 else 0 end)::int as parks_blocked,
  round(avg(c.completeness_score), 2) as avg_completeness_score,
  sum(case when not c.has_attractions then 1 else 0 end)::int as parks_missing_attractions,
  sum(case when not c.has_official_url then 1 else 0 end)::int as parks_missing_url,
  sum(case when not c.has_opening_hours then 1 else 0 end)::int as parks_missing_hours,
  sum(case when not c.has_coordinates then 1 else 0 end)::int as parks_missing_coordinates,
  sum(case when not c.has_park_areas then 1 else 0 end)::int as parks_missing_areas,
  max((not c.has_region_briefing)::int)::int as region_without_briefing,
  sum(case when not c.has_park_briefing then 1 else 0 end)::int as parks_missing_park_briefing
from public.park_alignment_completeness c
group by c.region_id;

comment on view public.region_alignment_rollup is
  'Region-level rollups over park_alignment_completeness rows.';

grant select on public.park_areas to anon, authenticated;
grant select on public.region_briefings to anon, authenticated;
grant select on public.park_briefings to anon, authenticated;

grant select on public.park_alignment_completeness to anon, authenticated;
grant select on public.region_alignment_rollup to anon, authenticated;
