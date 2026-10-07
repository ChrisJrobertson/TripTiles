-- ============================================================================
-- Fix infinite recursion in RLS policies
--
-- Problem: the "trips" select policy queried "profiles", and the "profiles"
-- select policy queried "profiles" itself, creating a loop Postgres detects
-- and aborts.
--
-- Fix: use a SECURITY DEFINER helper function that bypasses RLS for the
-- specific lookups we need (current user's agency_id and tier). The function
-- runs with the privileges of the function owner (postgres), so it can read
-- profiles without triggering the profiles RLS policy.
-- ============================================================================

-- Helper: get the current user's agency_id (or null) without triggering RLS
create or replace function public.current_user_agency_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select agency_id from profiles where id = auth.uid();
$$;

-- Helper: get the current user's tier without triggering RLS
create or replace function public.current_user_tier()
returns user_tier
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tier from profiles where id = auth.uid();
$$;

-- Grant execute to authenticated users
grant execute on function public.current_user_agency_id() to authenticated, anon;
grant execute on function public.current_user_tier() to authenticated, anon;

-- ============================================================================
-- Rewrite the broken policies to use the helper functions
-- ============================================================================

-- PROFILES: split the select policy into two separate non-recursive policies
drop policy if exists "Profiles select own or agency" on profiles;

create policy "Profiles select own"
  on profiles for select using ((select auth.uid()) = id);

create policy "Profiles select agency members"
  on profiles for select using (
    agency_id is not null
    and agency_id = current_user_agency_id()
    and current_user_tier() = 'agent_admin'
  );

-- AGENCIES: rewrite to use the helper
drop policy if exists "Agencies select for members" on agencies;
drop policy if exists "Agencies update for admins" on agencies;

create policy "Agencies select for members"
  on agencies for select using (id = current_user_agency_id());

create policy "Agencies update for admins"
  on agencies for update using (
    id = current_user_agency_id() and current_user_tier() = 'agent_admin'
  );

-- TRIPS: rewrite the select policy to use the helper for the agency check
drop policy if exists "Trips select" on trips;

create policy "Trips select"
  on trips for select using (
    is_public = true
    or owner_id = (select auth.uid())
    or id in (
      select trip_id from trip_collaborators
      where user_id = (select auth.uid()) and status = 'accepted'
    )
    or (
      agency_id is not null
      and agency_id = current_user_agency_id()
    )
  );

-- PARKS: also rewrite for safety since it referenced profiles
drop policy if exists "Parks select" on parks;

create policy "Parks select"
  on parks for select using (
    (is_custom = false and agency_id is null)
    or created_by = (select auth.uid())
    or (agency_id is not null and agency_id = current_user_agency_id())
  );
