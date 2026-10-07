
-- ============================================================================
-- Custom user tiles: let users add their own parks/restaurants/excursions
-- that TripTiles doesn't have built-in.
--
-- Design decisions:
-- 1. Private to the user (RLS enforced)
-- 2. Scoped to a region by default (region_ids array like built-in parks)
-- 3. Optional "save to library" flag for tiles the user wants on every trip
-- 4. Uses same park_group taxonomy as built-in parks so they render in the
--    right palette sections
-- 5. Free-text icon field (emoji) plus colour fields for branding
-- 6. Optional notes/url/address for extra context
-- 7. Referenced by ID in trip.assignments just like built-in parks
-- ============================================================================

create table if not exists custom_tiles (
  id text primary key,                    -- user-prefix format: 'ct_<nanoid>'
  user_id uuid not null references profiles(id) on delete cascade,
  
  -- Core fields (required)
  name text not null,                      -- 'Nonna''s Pizza', 'Aunt Sally''s House'
  park_group text not null,                -- 'attractions', 'dining', 'sights', 'excursions', 'activities', 'travel'
  bg_colour text not null default '#0B1E5C',
  fg_colour text not null default '#C9A961',
  
  -- Scoping
  region_ids text[] not null default array[]::text[],  -- which regions this tile appears in
  save_to_library boolean not null default false,       -- if true, shows on all trips regardless of region
  
  -- Optional extras
  icon text,                               -- emoji like '🍕' or '🏰'
  notes text,                              -- user's free text note
  address text,                            -- optional address
  url text,                                -- optional website/booking link
  
  -- Metadata
  trips_used_count int not null default 0,    -- how many trips have used this tile (for analytics)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Validation
  constraint custom_tiles_name_length check (char_length(name) > 0 and char_length(name) <= 40),
  constraint custom_tiles_park_group_valid check (
    park_group in ('disney', 'disneyextra', 'universal', 'seaworld', 'attractions', 
                   'sights', 'excursions', 'dining', 'activities', 'travel')
  ),
  constraint custom_tiles_bg_colour_hex check (bg_colour ~ '^#[0-9A-Fa-f]{6}$'),
  constraint custom_tiles_fg_colour_hex check (fg_colour ~ '^#[0-9A-Fa-f]{6}$')
);

create index if not exists idx_custom_tiles_user on custom_tiles(user_id);
create index if not exists idx_custom_tiles_library on custom_tiles(user_id) where save_to_library = true;
create index if not exists idx_custom_tiles_region on custom_tiles using gin(region_ids);

-- RLS: users can only see/modify their own custom tiles
alter table custom_tiles enable row level security;

create policy "Users can view their own custom tiles"
  on custom_tiles for select using (user_id = (select auth.uid()));

create policy "Users can insert their own custom tiles"
  on custom_tiles for insert with check (user_id = (select auth.uid()));

create policy "Users can update their own custom tiles"
  on custom_tiles for update using (user_id = (select auth.uid()));

create policy "Users can delete their own custom tiles"
  on custom_tiles for delete using (user_id = (select auth.uid()));

-- ============================================================================
-- Helper function to get a user's effective tile limit by tier
-- Free: 5 custom tiles total
-- Pro/Family: unlimited
-- Premium: unlimited + sync across trips
-- ============================================================================
create or replace function user_custom_tile_limit(uid uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when tier = 'free' then 5
    else 999999  -- effectively unlimited
  end
  from profiles
  where id = uid;
$$;

-- ============================================================================
-- Achievement for creating first custom tile
-- ============================================================================
insert into achievement_definitions (key, title, description, icon, category, threshold, sort_order) values
  ('first_custom_tile',  'Make It Yours',   'Created your first custom tile',        '✨', 'milestone', 1, 4),
  ('custom_tiles_10',    'Tile Collector',  'Created 10 custom tiles',               '🎨', 'trips',    10, 14),
  ('custom_tiles_25',    'Master Curator',  'Created 25 custom tiles',               '🏅', 'trips',    25, 15)
on conflict (key) do nothing;
;
