-- EMERGENCY ROLLBACK ONLY. Restores known dangerous privileges.
-- Isolated/local use. Prefer a forward-fix in any hosted environment.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP TRIGGER IF EXISTS guard_trip_collaborator_update
  ON public.trip_collaborators;
DROP FUNCTION IF EXISTS private.guard_trip_collaborator_update();

DROP POLICY IF EXISTS "Collaborators accept matching pending invite"
  ON public.trip_collaborators;
DROP POLICY IF EXISTS "Collaborators update by trip owner"
  ON public.trip_collaborators;
DROP POLICY IF EXISTS "Collaborators update invitee or owner"
  ON public.trip_collaborators;

DROP FUNCTION IF EXISTS private.auth_email_is_verified();
DROP FUNCTION IF EXISTS public.increment_ai_generations_lifetime(uuid);
CREATE POLICY "Collaborators update invitee or owner"
  ON public.trip_collaborators FOR UPDATE TO public
  USING (
    user_id = (SELECT auth.uid())
    OR private.is_trip_owner(trip_id)
    OR (
      status = 'pending'::public.invite_status
      AND lower(invited_email) = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid()) OR private.is_trip_owner(trip_id)
  );

DROP POLICY IF EXISTS "Collaborators insert by trip owner" ON public.trip_collaborators;
CREATE POLICY "Collaborators insert by trip owner"
  ON public.trip_collaborators FOR INSERT TO public
  WITH CHECK (
    invited_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.trips
      WHERE id = trip_collaborators.trip_id
      AND owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Agencies update for admins" ON public.agencies;
CREATE POLICY "Agencies update for admins" ON public.agencies
  FOR UPDATE TO public
  USING (
    id = private.current_user_agency_id()
    AND private.current_user_tier() = 'agent_admin'::public.user_tier
  );

DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "Profiles update own" ON public.profiles
  FOR UPDATE TO public USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Purchases insert own" ON public.purchases;
CREATE POLICY "Purchases insert own" ON public.purchases
  FOR INSERT TO public WITH CHECK (user_id = (SELECT auth.uid()));

GRANT ALL PRIVILEGES ON TABLE
  public.profiles,
  public.purchases,
  public.agencies,
  public.trip_collaborators
TO authenticated;
COMMIT;
