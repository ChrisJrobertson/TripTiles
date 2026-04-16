
-- ============================================================================
-- Comprehensive RLS recursion fix
--
-- The previous fix (migration 14) handled the trips ↔ profiles loop but
-- missed the trips ↔ trip_collaborators loop, which is the one actually
-- breaking the planner page.
--
-- Loop 2 detail:
--   - "Trips select" policy queries trip_collaborators (for shared trips)
--   - "Collaborators select" policy queries trips (to check ownership)
--   - These cross-reference each other → infinite recursion
--
-- Fix: SECURITY DEFINER helper functions that bypass RLS for the lookups
-- both policies need. The functions read data with elevated privileges so
-- they don't re-trigger the policies that called them.
-- ============================================================================

-- Helper: does the current user own this trip?
create or replace function public.user_owns_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from trips
    where id = p_trip_id and owner_id = auth.uid()
  );
$$;

-- Helper: list of trip ids the current user can collaborate on
create or replace function public.user_collaborator_trip_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select trip_id from trip_collaborators
  where user_id = auth.uid() and status = 'accepted';
$$;

-- Helper: list of trip ids the current user can EDIT as a collaborator
create or replace function public.user_editor_trip_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select trip_id from trip_collaborators
  where user_id = auth.uid() and status = 'accepted' and role = 'editor';
$$;

grant execute on function public.user_owns_trip(uuid) to authenticated, anon;
grant execute on function public.user_collaborator_trip_ids() to authenticated, anon;
grant execute on function public.user_editor_trip_ids() to authenticated, anon;

-- ============================================================================
-- Rewrite trips policies to use the helper functions
-- ============================================================================

drop policy if exists "Trips select" on trips;
drop policy if exists "Trips update own or editor" on trips;

create policy "Trips select"
  on trips for select using (
    is_public = true
    or owner_id = (select auth.uid())
    or id in (select user_collaborator_trip_ids())
    or (
      agency_id is not null
      and agency_id = current_user_agency_id()
    )
  );

create policy "Trips update own or editor"
  on trips for update using (
    owner_id = (select auth.uid())
    or id in (select user_editor_trip_ids())
  );

-- ============================================================================
-- Rewrite trip_collaborators policies to use user_owns_trip helper
-- ============================================================================

drop policy if exists "Collaborators select" on trip_collaborators;
drop policy if exists "Collaborators insert by owner" on trip_collaborators;
drop policy if exists "Collaborators delete by owner" on trip_collaborators;

create policy "Collaborators select"
  on trip_collaborators for select using (
    user_id = (select auth.uid())
    or user_owns_trip(trip_id)
  );

create policy "Collaborators insert by owner"
  on trip_collaborators for insert with check (
    user_owns_trip(trip_id)
  );

create policy "Collaborators delete by owner"
  on trip_collaborators for delete using (
    user_owns_trip(trip_id)
  );

-- ============================================================================
-- Make sure payhip_products has RLS enabled (Cursor created this table
-- during Session 3 but the audit shows the SELECT policy is ok)
-- ============================================================================

alter table if exists payhip_products enable row level security;
;
