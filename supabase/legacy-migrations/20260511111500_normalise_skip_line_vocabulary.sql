-- Phase 2: Normalise legacy skip-line vocabulary to canonical values.
-- Pre-flight (May 2026): 37 disney_lightning_lane, 23 universal_express, 10 tier premier_access,
--   14 multi_pass tier, 4 region premier ids, 5 region universal ids — 75 row touches + 10 tier NULLs.
-- FK: region_skip_line_systems references skip_line_systems(id) — insert canonical rows before region UPDATEs.

insert into public.skip_line_systems (id, name, description, parent_brand)
values
  (
    'premier_access',
    'Disney Premier Access',
    'Disney paid line-skip (Premier Access) at Disneyland Paris, Tokyo Disney Resort, Shanghai Disney Resort, and Hong Kong Disneyland.',
    'disney'
  ),
  (
    'express',
    'Universal Express Pass',
    'Universal paid line-skip product at Universal parks worldwide.',
    'universal'
  )
on conflict (id) do nothing;

-- --- attractions.skip_line_system ---

update attractions
set skip_line_system = 'lightning_lane'
where skip_line_system = 'disney_lightning_lane';

update attractions
set skip_line_system = 'express'
where skip_line_system = 'universal_express';

-- --- attractions.skip_line_tier (Premier Access has no per-ride tier at DLP/WDSP) ---

update attractions
set skip_line_tier = null
where skip_line_tier = 'premier_access';

-- --- region_skip_line_systems.skip_line_system_id ---

update region_skip_line_systems
set skip_line_system_id = 'premier_access'
where skip_line_system_id in (
  'hongkong_disney_premier',
  'shanghai_disney_premier',
  'tokyo_disney_premier',
  'disneyland_paris_premier_access'
);

update region_skip_line_systems
set skip_line_system_id = 'express'
where skip_line_system_id in (
  'universal_express',
  'universal_japan_express',
  'universal_singapore_express'
);

-- Obsolete reference rows (no longer referenced after region updates)

delete from public.skip_line_systems
where id in (
  'hongkong_disney_premier',
  'shanghai_disney_premier',
  'tokyo_disney_premier',
  'disneyland_paris_premier_access',
  'universal_express',
  'universal_japan_express',
  'universal_singapore_express'
);
