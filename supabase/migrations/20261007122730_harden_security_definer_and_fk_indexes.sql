-- Advisor follow-up after the canonical baseline.
-- Internal SECURITY DEFINER helpers move to schema private so PostgREST cannot expose them.
-- Product RPCs stay in public for the app, but anon cannot execute them.
-- Foreign keys flagged as unindexed get a supporting index.

create or replace function private.current_user_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select agency_id from public.profiles where id = auth.uid();
$$;

create or replace function private.current_user_tier()
returns public.user_tier
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tier from public.profiles where id = auth.uid();
$$;

create or replace function private.recalc_profile_trip_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid;
begin
  uid := coalesce(new.owner_id, old.owner_id);
  update public.profiles
  set
    trips_planned_count = (select count(*) from public.trips where owner_id = uid),
    days_planned_count = coalesce((
      select sum((end_date - start_date) + 1)::int
      from public.trips
      where owner_id = uid
    ), 0),
    last_active_at = now()
  where id = uid;
  return coalesce(new, old);
end;
$$;

revoke all on function private.current_user_agency_id() from public;
revoke all on function private.current_user_tier() from public;
revoke all on function private.recalc_profile_trip_stats() from public;
grant execute on function private.current_user_agency_id() to anon, authenticated, service_role;
grant execute on function private.current_user_tier() to anon, authenticated, service_role;
grant execute on function private.recalc_profile_trip_stats() to authenticated, service_role;

drop policy if exists "Agencies select for members" on public.agencies;
create policy "Agencies select for members"
  on public.agencies for select
  using (id = private.current_user_agency_id());

drop policy if exists "Agencies update for admins" on public.agencies;
create policy "Agencies update for admins"
  on public.agencies for update
  using (
    id = private.current_user_agency_id()
    and private.current_user_tier() = 'agent_admin'
  );

drop policy if exists "Profiles select agency members" on public.profiles;
create policy "Profiles select agency members"
  on public.profiles for select
  using (
    agency_id is not null
    and agency_id = private.current_user_agency_id()
    and private.current_user_tier() = 'agent_admin'
  );

drop policy if exists "Parks select" on public.parks;
create policy "Parks select"
  on public.parks for select
  using (
    (is_custom = false and agency_id is null)
    or created_by = (select auth.uid())
    or (agency_id is not null and agency_id = private.current_user_agency_id())
  );

drop function if exists public.current_user_agency_id();
drop function if exists public.current_user_tier();

drop trigger if exists trips_update_profile_stats on public.trips;
create trigger trips_update_profile_stats
  after insert or update or delete on public.trips
  for each row execute function private.recalc_profile_trip_stats();
drop function if exists public.recalc_profile_trip_stats();

-- Tile limit is only meaningful for the signed-in user.
create or replace function public.user_custom_tile_limit(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when tier = 'free' then 5
    else 999999
  end
  from public.profiles
  where id = uid
    and id = auth.uid();
$$;

revoke all on function public.user_custom_tile_limit(uuid) from public, anon;
revoke all on function public.append_trip_behaviour_signal(uuid, uuid, jsonb) from public, anon;
revoke all on function public.save_day_plan_feedback(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.save_trip_planning_profile(uuid, uuid, jsonb) from public, anon;
revoke all on function public.set_trip_day_planning_intent(uuid, uuid, text, jsonb) from public, anon;

grant execute on function public.user_custom_tile_limit(uuid) to authenticated, service_role;
grant execute on function public.append_trip_behaviour_signal(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.save_day_plan_feedback(uuid, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.save_trip_planning_profile(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.set_trip_day_planning_intent(uuid, uuid, text, jsonb) to authenticated, service_role;

drop policy if exists "Collaborators select participant or owner" on public.trip_collaborators;
create policy "Collaborators select participant or owner"
  on public.trip_collaborators for select
  using (
    user_id = (select auth.uid())
    or invited_by = (select auth.uid())
    or private.is_trip_owner(trip_id)
    or (
      status = 'pending'
      and lower(invited_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    )
  );

drop policy if exists "Collaborators update invitee or owner" on public.trip_collaborators;
create policy "Collaborators update invitee or owner"
  on public.trip_collaborators for update
  using (
    user_id = (select auth.uid())
    or private.is_trip_owner(trip_id)
    or (
      status = 'pending'
      and lower(invited_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
    )
  )
  with check (
    user_id = (select auth.uid())
    or private.is_trip_owner(trip_id)
  );

create index if not exists idx_email_queue_trip_id on public.email_queue (trip_id);
create index if not exists idx_feedback_user_id on public.feedback (user_id);
create index if not exists idx_live_wait_provider_mappings_park_id on public.live_wait_provider_mappings (park_id);
create index if not exists idx_park_briefings_supersedes_id on public.park_briefings (supersedes_id);
create index if not exists idx_parks_created_by on public.parks (created_by);
create index if not exists idx_profiles_referred_by on public.profiles (referred_by);
create index if not exists idx_region_briefings_supersedes_id on public.region_briefings (supersedes_id);
create index if not exists idx_region_skip_line_systems_system_id on public.region_skip_line_systems (skip_line_system_id);
create index if not exists idx_trip_collaborators_invited_by on public.trip_collaborators (invited_by);
create index if not exists idx_trip_ride_priorities_attraction_id on public.trip_ride_priorities (attraction_id);
