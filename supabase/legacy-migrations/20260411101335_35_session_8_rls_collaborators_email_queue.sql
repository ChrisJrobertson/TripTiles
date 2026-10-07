
-- ============================================================================
-- Session 8 prep: RLS for collaborators and email_queue
-- 
-- trip_collaborators needs:
--   INSERT: only the trip owner can invite people
--   UPDATE: the invited user can accept (status -> 'accepted') or decline
--   DELETE: the trip owner can revoke an invite
--
-- email_queue needs:
--   INSERT: users can schedule emails for their own trips
--   UPDATE: service role only (the cron job that sends emails)
-- ============================================================================

-- trip_collaborators INSERT: only trip owners can invite
create policy "Collaborators insert by trip owner"
  on trip_collaborators for insert
  with check (
    invited_by = (select auth.uid())
    and exists (
      select 1 from trips where id = trip_id and owner_id = (select auth.uid())
    )
  );

-- trip_collaborators UPDATE: the invited user (once signed up) can accept/decline,
-- OR the trip owner can update (e.g. change role)
create policy "Collaborators update by invitee or owner"
  on trip_collaborators for update
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from trips where id = trip_id and owner_id = (select auth.uid())
    )
  );

-- trip_collaborators DELETE: only the trip owner can revoke
create policy "Collaborators delete by trip owner"
  on trip_collaborators for delete
  using (
    exists (
      select 1 from trips where id = trip_id and owner_id = (select auth.uid())
    )
  );

-- email_queue INSERT: users can schedule emails for their own trips
-- (the actual sending happens via service_role from a cron job)
create policy "Email queue insert own"
  on email_queue for insert
  with check (user_id = (select auth.uid()));
;
