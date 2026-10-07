
-- ============================================================================
-- Global expansion: replace the destination enum with a flexible regions table
-- 
-- The original 'destination' enum had 6 values: orlando, paris, tokyo, cali,
-- cruise, custom. This doesn't scale to a global product where we want to
-- support 25+ regions across 6 continents.
--
-- New structure:
--   regions table (id, slug, name, country, country_code, sort_order, etc)
--   trips.region_id references regions(id)
--   parks.region_ids array references regions (a park can be in multiple
--     regions, e.g. a cruise excursion that's relevant to multiple sailings)
--
-- We KEEP the destination enum for backwards compatibility with existing
-- code (Cursor's Session 3+4 components use it) and add the region_id
-- alongside. Cursor's Session 5 will be the first to use region_id directly.
-- ============================================================================

-- New regions table
create table if not exists regions (
  id text primary key,                  -- short slug like 'orlando', 'shanghai', 'uae'
  name text not null,                   -- display name like 'Orlando, Florida'
  short_name text not null,             -- short label for UI like 'Orlando'
  country text not null,                -- 'United States', 'China', 'United Arab Emirates'
  country_code text not null,           -- ISO 3166-1 alpha-2: 'US', 'CN', 'AE'
  continent text not null,              -- 'North America', 'Asia', 'Middle East', etc
  flag_emoji text,                      -- '🇺🇸', '🇨🇳', '🇦🇪'
  description text,                     -- one-line summary
  is_active boolean not null default true,
  is_featured boolean not null default false,  -- show prominently in destination picker
  sort_order int not null default 100,
  created_at timestamptz default now()
);

create index if not exists idx_regions_continent on regions(continent);
create index if not exists idx_regions_country on regions(country_code);
create index if not exists idx_regions_featured on regions(is_featured) where is_featured = true;

-- Public read - anyone can see the list of regions
alter table regions enable row level security;
create policy "Anyone can read regions"
  on regions for select using (true);

-- ============================================================================
-- Seed all 25+ global destinations
-- ============================================================================

insert into regions (id, name, short_name, country, country_code, continent, flag_emoji, description, is_featured, sort_order) values

-- North America (featured)
('orlando',     'Orlando, Florida',           'Orlando',         'United States',     'US', 'North America', '🇺🇸', 'Walt Disney World, Universal Orlando, SeaWorld and more', true,  10),
('cali',        'Anaheim & California',       'California',      'United States',     'US', 'North America', '🇺🇸', 'Disneyland Resort, Universal Hollywood, Knott''s Berry Farm', true,  11),
('lasvegas',    'Las Vegas',                  'Las Vegas',       'United States',     'US', 'North America', '🇺🇸', 'Adventuredome and Strip attractions', false, 12),
('toronto',     'Toronto',                    'Toronto',         'Canada',            'CA', 'North America', '🇨🇦', 'Canada''s Wonderland and Toronto attractions', false, 13),
('mexico',      'Mexico',                     'Mexico',          'Mexico',            'MX', 'North America', '🇲🇽', 'Six Flags Mexico, Xcaret and Riviera Maya', false, 14),

-- Europe (featured)
('paris',       'Paris',                      'Paris',           'France',            'FR', 'Europe',        '🇫🇷', 'Disneyland Paris, Parc Astérix and the city of lights', true,  20),
('uk',          'United Kingdom',             'UK',              'United Kingdom',    'GB', 'Europe',        '🇬🇧', 'Alton Towers, Thorpe Park, LEGOLAND Windsor, Paultons', true,  21),
('germany',     'Germany',                    'Germany',         'Germany',           'DE', 'Europe',        '🇩🇪', 'Europa-Park, Phantasialand, LEGOLAND Deutschland', true,  22),
('spain',       'Costa Daurada, Spain',       'Spain',           'Spain',             'ES', 'Europe',        '🇪🇸', 'PortAventura, Ferrari Land, Caribe Aquatic Park', true,  23),
('netherlands', 'Netherlands',                'Netherlands',     'Netherlands',       'NL', 'Europe',        '🇳🇱', 'Efteling, Walibi Holland and Amsterdam', false, 24),
('denmark',     'Denmark',                    'Denmark',         'Denmark',           'DK', 'Europe',        '🇩🇰', 'Tivoli Gardens, LEGOLAND Billund (the original)', false, 25),
('italy',       'Italy',                      'Italy',           'Italy',             'IT', 'Europe',        '🇮🇹', 'Gardaland, Mirabilandia and Italian classics', false, 26),
('belgium',     'Belgium',                    'Belgium',         'Belgium',           'BE', 'Europe',        '🇧🇪', 'Walibi Belgium and Plopsaland', false, 27),
('sweden',      'Sweden',                     'Sweden',          'Sweden',            'SE', 'Europe',        '🇸🇪', 'Liseberg and Gröna Lund', false, 28),
('finland',     'Finland',                    'Finland',         'Finland',           'FI', 'Europe',        '🇫🇮', 'Linnanmäki and Helsinki', false, 29),

-- Asia (featured)
('tokyo',       'Tokyo',                      'Tokyo',           'Japan',             'JP', 'Asia',          '🇯🇵', 'Tokyo Disney, Universal Studios Japan, teamLab', true,  30),
('osaka',       'Osaka & Kansai',             'Osaka',           'Japan',             'JP', 'Asia',          '🇯🇵', 'Universal Studios Japan and the Kansai region', false, 31),
('shanghai',    'Shanghai',                   'Shanghai',        'China',             'CN', 'Asia',          '🇨🇳', 'Shanghai Disneyland and Disneytown', true,  32),
('hongkong',    'Hong Kong',                  'Hong Kong',       'Hong Kong',         'HK', 'Asia',          '🇭🇰', 'Hong Kong Disneyland and Ocean Park', true,  33),
('singapore',   'Singapore',                  'Singapore',       'Singapore',         'SG', 'Asia',          '🇸🇬', 'Universal Studios Singapore and Sentosa', true,  34),
('seoul',       'Seoul',                      'Seoul',           'South Korea',       'KR', 'Asia',          '🇰🇷', 'Everland and Lotte World', false, 35),

-- Middle East
('uae',         'Dubai & Abu Dhabi',          'UAE',             'United Arab Emirates','AE','Middle East',   '🇦🇪', 'IMG Worlds, Motiongate, Ferrari World, Warner Bros, LEGOLAND Dubai', true, 40),

-- Oceania
('goldcoast',   'Gold Coast, Australia',      'Gold Coast',      'Australia',         'AU', 'Oceania',       '🇦🇺', 'Movie World, Sea World, Dreamworld, Wet''n''Wild', true,  50),
('sydney',      'Sydney',                     'Sydney',          'Australia',         'AU', 'Oceania',       '🇦🇺', 'Sydney attractions and day trips', false, 51),

-- Cruises (a special "region" that's location-agnostic)
('cruise',      'Cruise Holiday',             'Cruise',          'At Sea',            'XX', 'Cruise',        '🚢', 'Disney Cruise, Royal Caribbean, MSC, Carnival and more', true, 60),

-- Catch-all for everything else
('custom',      'Other / Multi-Region',       'Custom',          'Worldwide',         'XX', 'Other',         '🌍', 'Build a trip with parks from anywhere in the world',          false, 999);

-- ============================================================================
-- Add region_id to trips (alongside the existing destination enum for now)
-- ============================================================================

alter table trips
  add column if not exists region_id text references regions(id);

-- Backfill region_id for existing trips based on the old destination enum
update trips set region_id = destination::text where region_id is null;

create index if not exists idx_trips_region on trips(region_id);

-- ============================================================================
-- Add region_ids array to parks (a park can belong to multiple regions)
-- ============================================================================

alter table parks
  add column if not exists region_ids text[] not null default array[]::text[];

-- Backfill region_ids for existing parks based on the old destinations array
update parks set region_ids = destinations::text[]::text[] where region_ids = '{}';

create index if not exists idx_parks_region_ids on parks using gin(region_ids);
;
