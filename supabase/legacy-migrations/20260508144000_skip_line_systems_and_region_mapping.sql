create table public.skip_line_systems (
  id text primary key,
  name text not null,
  description text,
  parent_brand text,
  created_at timestamptz not null default now()
);

create table public.region_skip_line_systems (
  region_id text not null references public.regions(id) on delete cascade,
  skip_line_system_id text not null references public.skip_line_systems(id) on delete restrict,
  primary key (region_id, skip_line_system_id)
);

alter table public.skip_line_systems enable row level security;
alter table public.region_skip_line_systems enable row level security;

create policy "read skip line systems"
  on public.skip_line_systems
  for select
  to authenticated
  using (true);

create policy "read region skip line systems"
  on public.region_skip_line_systems
  for select
  to authenticated
  using (true);

insert into public.skip_line_systems (id, name, description, parent_brand)
values
  ('lightning_lane', 'Disney Lightning Lane / Genie+', 'Disney''s paid line-skip system at Walt Disney World and Disneyland Resort.', 'disney'),
  ('universal_express', 'Universal Express Pass', 'Universal''s paid line-skip system at Universal Orlando and Universal Hollywood.', 'universal'),
  ('disneyland_paris_premier_access', 'Disney Premier Access', 'Disneyland Paris paid line-skip system.', 'disney'),
  ('tokyo_disney_premier', 'Tokyo Disney Premier Access', 'Tokyo Disney Resort paid line-skip system.', 'disney'),
  ('shanghai_disney_premier', 'Shanghai Disney Premier Access', 'Shanghai Disney Resort paid line-skip system.', 'disney'),
  ('hongkong_disney_premier', 'Hong Kong Disney Premier Access', 'Hong Kong Disneyland paid line-skip system.', 'disney'),
  ('universal_japan_express', 'Universal Studios Japan Express Pass', 'Universal Studios Japan paid line-skip system.', 'universal'),
  ('universal_singapore_express', 'Universal Studios Singapore Express', 'Universal Studios Singapore paid line-skip system.', 'universal'),
  ('none', 'No line-skip system', 'No formal line-skip system tracked for this region in this phase.', null);
