
-- ============================================================================
-- SIMPLIFY: strip the trips and trip_collaborators policies down to the
-- absolute minimum needed for Session 3.
--
-- We're not using collaborators or agencies until Sessions 8 and 9. The
-- previous attempts to make those features work via SECURITY DEFINER helpers
-- introduced recursion paths that I couldn't fully trace. Best engineering
-- choice: drop the unused complexity, get unblocked, re-add cleanly later
-- when those features are actually needed.
--
-- The simple version: a user can see trips they own, full stop. Plus public
-- trips for the future template gallery. That's it. Nothing references any
-- other table.
-- ============================================================================

-- Drop everything on trips
drop policy if exists "Trips select" on trips;
drop policy if exists "Trips insert own" on trips;
drop policy if exists "Trips update own or editor" on trips;
drop policy if exists "Trips delete own" on trips;

-- Recreate with the absolute minimum
create policy "Trips select own or public"
  on trips for select using (
    is_public = true
    or owner_id = (select auth.uid())
  );

create policy "Trips insert own"
  on trips for insert with check (
    owner_id = (select auth.uid())
  );

create policy "Trips update own"
  on trips for update using (
    owner_id = (select auth.uid())
  );

create policy "Trips delete own"
  on trips for delete using (
    owner_id = (select auth.uid())
  );

-- Drop the cross-referencing trip_collaborators policies entirely
-- We'll re-add proper ones in Session 8 when we build invites
drop policy if exists "Collaborators select" on trip_collaborators;
drop policy if exists "Collaborators insert by owner" on trip_collaborators;
drop policy if exists "Collaborators delete by owner" on trip_collaborators;

-- Minimal placeholder: only the user themselves can see their own
-- collaborator entries (e.g. invitations to them). No cross-references.
create policy "Collaborators select own only"
  on trip_collaborators for select using (
    user_id = (select auth.uid())
  );

-- ============================================================================
-- Force Postgrest to reload its schema cache so the new policies take effect
-- on the next API request from Cursor's dev server
-- ============================================================================

notify pgrst, 'reload schema';
;
