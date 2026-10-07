
-- ============================================================================
-- Gamification + account value features
--
-- Goal: make TripTiles accounts feel valuable enough that users don't want
-- to lose their progress by creating sock-puppet accounts.
--
-- Mechanics added:
-- 1. Profile stats (trips planned, days planned, parks visited, AI gens used)
-- 2. Achievements (badges unlocked at milestones)
-- 3. Park check-ins (which parks the user has planned for)
-- 4. Public template stats (how many clones)
-- ============================================================================

-- Add stats columns to profiles for gamification display
alter table profiles
  add column if not exists trips_planned_count int not null default 0,
  add column if not exists days_planned_count int not null default 0,
  add column if not exists parks_visited_count int not null default 0,
  add column if not exists ai_generations_lifetime int not null default 0,
  add column if not exists templates_cloned_count int not null default 0,
  add column if not exists last_active_at timestamptz default now();

-- Achievements table - one row per badge a user has earned
create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  achievement_key text not null,
  earned_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb,
  unique (user_id, achievement_key)
);

create index if not exists idx_achievements_user on achievements(user_id);

alter table achievements enable row level security;

create policy "Users can view their own achievements"
  on achievements for select using (user_id = (select auth.uid()));

create policy "Users can insert their own achievements"
  on achievements for insert with check (user_id = (select auth.uid()));

-- Park check-ins - track which parks each user has planned for
create table if not exists park_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  park_id text not null references parks(id) on delete cascade,
  first_planned_at timestamptz not null default now(),
  trips_count int not null default 1,
  unique (user_id, park_id)
);

create index if not exists idx_checkins_user on park_checkins(user_id);
create index if not exists idx_checkins_park on park_checkins(park_id);

alter table park_checkins enable row level security;

create policy "Users can view their own checkins"
  on park_checkins for select using (user_id = (select auth.uid()));

create policy "Users can manage their own checkins"
  on park_checkins for insert with check (user_id = (select auth.uid()));

create policy "Users can update their own checkins"
  on park_checkins for update using (user_id = (select auth.uid()));

-- Trip clone tracking - count how many times public trips get cloned
alter table trips
  add column if not exists clone_count int not null default 0,
  add column if not exists view_count int not null default 0;

-- Achievement definitions (reference data, no RLS needed)
create table if not exists achievement_definitions (
  key text primary key,
  title text not null,
  description text not null,
  icon text not null,
  category text not null,
  threshold int,
  sort_order int default 100
);

-- Seed the achievement catalogue
insert into achievement_definitions (key, title, description, icon, category, threshold, sort_order) values
  -- First steps
  ('first_trip',           'First Adventure',      'You planned your very first trip', '🎉', 'milestone', 1,   1),
  ('first_ai_plan',        'AI Magic',             'You generated your first AI plan', '✨', 'milestone', 1,   2),
  ('first_pdf_export',     'Made It Real',         'You exported your first PDF',      '📄', 'milestone', 1,   3),
  
  -- Trip count milestones
  ('trips_3',              'Triple Threat',        'Planned 3 trips',                   '🥉', 'trips',     3,   10),
  ('trips_5',              'High Five',            'Planned 5 trips',                   '🖐️', 'trips',     5,   11),
  ('trips_10',             'Veteran Planner',      'Planned 10 trips',                  '🏆', 'trips',     10,  12),
  ('trips_25',             'Travel Master',        'Planned 25 trips',                  '👑', 'trips',     25,  13),

  -- Park collection (passport stamps)
  ('parks_5',              'Park Explorer',        'Added 5 different parks',           '🏰', 'parks',     5,   20),
  ('parks_15',             'Park Connoisseur',     'Added 15 different parks',          '🎢', 'parks',     15,  21),
  ('parks_30',             'Park Champion',        'Added 30 different parks',          '🌟', 'parks',     30,  22),
  ('parks_all_disney',     'Disney Devotee',       'Planned every Disney park',         '🐭', 'parks',     null, 23),
  ('parks_all_universal',  'Universal Explorer',   'Planned every Universal park',      '🦖', 'parks',     null, 24),
  
  -- Destination passport stamps (one per destination)
  ('dest_orlando',         'Florida Sunshine',     'Planned an Orlando trip',           '🌴', 'destinations', 1, 30),
  ('dest_paris',           'Bonjour Disney',       'Planned a Paris trip',              '🗼', 'destinations', 1, 31),
  ('dest_tokyo',           'Konnichiwa Tokyo',     'Planned a Tokyo trip',              '🗾', 'destinations', 1, 32),
  ('dest_cali',            'California Dreamin''',  'Planned a California trip',         '🌊', 'destinations', 1, 33),
  ('dest_cruise',          'Set Sail',             'Planned a cruise',                  '🚢', 'destinations', 1, 34),
  ('dest_grand_tour',      'Grand Tour',           'Planned trips to all 5 destinations','🌍', 'destinations', 5, 35),

  -- Engagement milestones
  ('days_30',              'Holiday Maker',        'Planned 30 days of adventures',     '📅', 'days',      30,  40),
  ('days_100',             'Century',              'Planned 100 days of adventures',    '💯', 'days',      100, 41),
  
  -- Social
  ('first_share',          'Sharing Caring',       'Made your first trip public',       '💌', 'social',    1,   50),
  ('first_clone',          'Inspiration',          'Someone cloned your trip',          '🌟', 'social',    1,   51),
  ('clones_10',            'Trendsetter',          'Your trips have been cloned 10 times','🚀', 'social',  10,  52),
  
  -- Loyalty
  ('upgraded_pro',         'Pro Member',           'Welcome to TripTiles Pro!',         '⭐', 'loyalty',   null, 60),
  ('upgraded_family',      'Family First',         'Welcome to TripTiles Family!',      '👨‍👩‍👧‍👦', 'loyalty', null, 61),
  ('upgraded_premium',     'Premium Adventurer',   'Welcome to TripTiles Premium!',     '💎', 'loyalty',   null, 62)
on conflict (key) do nothing;

-- Helper view: profile with stats and achievement count
create or replace view profile_with_stats
with (security_invoker = true) as
select
  p.*,
  (select count(*) from achievements where user_id = p.id) as achievement_count
from profiles p;

-- ============================================================================
-- Trigger: update profile stats when trips are inserted/updated/deleted
-- This keeps the gamification counters fresh without app-level wiring
-- ============================================================================

create or replace function recalc_profile_trip_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid;
begin
  uid := coalesce(new.owner_id, old.owner_id);
  
  update profiles
  set 
    trips_planned_count = (select count(*) from trips where owner_id = uid),
    days_planned_count = coalesce((
      select sum((end_date - start_date) + 1)::int 
      from trips 
      where owner_id = uid
    ), 0),
    last_active_at = now()
  where id = uid;
  
  return coalesce(new, old);
end;
$$;

drop trigger if exists trips_update_profile_stats on trips;
create trigger trips_update_profile_stats
  after insert or update or delete on trips
  for each row execute function recalc_profile_trip_stats();

-- Backfill stats for existing user
update profiles
set 
  trips_planned_count = (select count(*) from trips where owner_id = profiles.id),
  days_planned_count = coalesce((
    select sum((end_date - start_date) + 1)::int 
    from trips 
    where owner_id = profiles.id
  ), 0)
where exists (select 1 from trips where owner_id = profiles.id);
;
