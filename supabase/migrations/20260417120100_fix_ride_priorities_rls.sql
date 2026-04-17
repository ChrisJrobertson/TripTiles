-- Session 12A.1: split collaborator policy so viewers cannot DELETE/UPDATE via USING-only loophole.

drop policy if exists "Trip collaborators can manage ride priorities" on trip_ride_priorities;

drop policy if exists "trip_ride_priorities_collab_select" on trip_ride_priorities;
create policy "trip_ride_priorities_collab_select"
  on trip_ride_priorities for select
  using (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_ride_priorities.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
    )
  );

drop policy if exists "trip_ride_priorities_collab_insert" on trip_ride_priorities;
create policy "trip_ride_priorities_collab_insert"
  on trip_ride_priorities for insert
  with check (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_ride_priorities.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
        and tc.role = 'editor'
    )
  );

drop policy if exists "trip_ride_priorities_collab_update" on trip_ride_priorities;
create policy "trip_ride_priorities_collab_update"
  on trip_ride_priorities for update
  using (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_ride_priorities.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
        and tc.role = 'editor'
    )
  )
  with check (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_ride_priorities.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
        and tc.role = 'editor'
    )
  );

drop policy if exists "trip_ride_priorities_collab_delete" on trip_ride_priorities;
create policy "trip_ride_priorities_collab_delete"
  on trip_ride_priorities for delete
  using (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_ride_priorities.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
        and tc.role = 'editor'
    )
  );
