-- Session 4: allow trip owners to create, update, and delete their own rows.
-- Apply in Supabase SQL editor (or CLI) if inserts/updates fail with RLS.

drop policy if exists "Trips insert own" on trips;
create policy "Trips insert own"
  on trips for insert
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Trips update own" on trips;
create policy "Trips update own"
  on trips for update
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Trips delete own" on trips;
create policy "Trips delete own"
  on trips for delete
  using ((select auth.uid()) = owner_id);
