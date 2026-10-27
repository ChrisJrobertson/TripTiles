-- TripTiles security hardening — REVIEW DRAFT, isolated/local only.
-- Do not apply to inqexwdkuqdfdoaauxyw until staging JWT tests pass.
-- Corrections vs the 27 Oct ZIP:
--   * idempotent DROP TRIGGER / CREATE OR REPLACE
--   * family/agent_admin gate on collaborator INSERT (app already checks this)
--   * verified-email check via private.auth_email_is_verified()
--   * atomic increment_ai_generations_lifetime() for service_role only
--   * GRANT EXECUTE on the increment RPC withheld from anon/authenticated
-- Preserves 22 Oct "Trips select own or collaborator" (anon has no trips grant).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.purchases') IS NULL
     OR to_regclass('public.agencies') IS NULL
     OR to_regclass('public.trip_collaborators') IS NULL
     OR to_regclass('public.trips') IS NULL THEN
    RAISE EXCEPTION 'TripTiles hardening: expected tables are absent';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Profiles update own'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'purchases'
      AND policyname = 'Purchases insert own'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trip_collaborators'
      AND policyname = 'Collaborators update invitee or owner'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'agencies'
      AND policyname = 'Agencies update for admins'
  ) THEN
    RAISE EXCEPTION 'TripTiles hardening: existing policies have drifted';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION private.auth_email_is_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION private.auth_email_is_verified() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.auth_email_is_verified() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_ai_generations_lifetime(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  n integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) NOT IN ('service_role')
     AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'AI usage increment requires a trusted role'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles
  SET ai_generations_lifetime = coalesce(ai_generations_lifetime, 0) + 1,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING ai_generations_lifetime INTO n;
  IF n IS NULL THEN
    RAISE EXCEPTION 'Profile not found for usage increment'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.increment_ai_generations_lifetime(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_generations_lifetime(uuid)
  TO service_role;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (
  display_name,
  marketing_opt_in,
  currency,
  locale,
  temperature_unit,
  email_marketing_opt_out,
  preferences
) ON TABLE public.profiles TO authenticated;
DROP POLICY IF EXISTS "Profiles update own" ON public.profiles;
CREATE POLICY "Profiles update own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.purchases FROM authenticated;
DROP POLICY IF EXISTS "Purchases insert own" ON public.purchases;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.agencies FROM authenticated;
GRANT UPDATE (
  name, slug, logo_url, primary_colour, accent_colour,
  contact_email, contact_phone, website,
  booking_com_affiliate_id, viator_affiliate_id
) ON TABLE public.agencies TO authenticated;
DROP POLICY IF EXISTS "Agencies update for admins" ON public.agencies;
CREATE POLICY "Agencies update for admins" ON public.agencies
  FOR UPDATE TO authenticated
  USING (
    id = private.current_user_agency_id()
    AND private.current_user_tier() = 'agent_admin'::public.user_tier
  )
  WITH CHECK (
    id = private.current_user_agency_id()
    AND private.current_user_tier() = 'agent_admin'::public.user_tier
  );

REVOKE UPDATE, TRUNCATE, TRIGGER, REFERENCES
  ON TABLE public.trip_collaborators FROM authenticated;
GRANT UPDATE (status, user_id, accepted_at, role)
  ON TABLE public.trip_collaborators TO authenticated;

DROP POLICY IF EXISTS "Collaborators insert by trip owner" ON public.trip_collaborators;
CREATE POLICY "Collaborators insert by trip owner"
  ON public.trip_collaborators FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = (SELECT auth.uid())
    AND user_id IS NULL
    AND status = 'pending'::public.invite_status
    AND role IN ('viewer', 'editor')
    AND invite_token IS NOT NULL
    AND length(invite_token) > 0
    AND private.is_trip_owner(trip_id)
    AND private.current_user_tier() IN (
      'family'::public.user_tier,
      'agent_admin'::public.user_tier
    )
  );

DROP POLICY IF EXISTS "Collaborators update invitee or owner" ON public.trip_collaborators;
DROP POLICY IF EXISTS "Collaborators update by trip owner" ON public.trip_collaborators;
DROP POLICY IF EXISTS "Collaborators accept matching pending invite" ON public.trip_collaborators;

CREATE POLICY "Collaborators update by trip owner"
  ON public.trip_collaborators FOR UPDATE TO authenticated
  USING (private.is_trip_owner(trip_id))
  WITH CHECK (private.is_trip_owner(trip_id));

CREATE POLICY "Collaborators accept matching pending invite"
  ON public.trip_collaborators FOR UPDATE TO authenticated
  USING (
    status = 'pending'::public.invite_status
    AND user_id IS NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND private.auth_email_is_verified()
    AND lower(invited_email) = lower(coalesce((SELECT auth.jwt() ->> 'email'), ''))
  )
  WITH CHECK (
    status = 'accepted'::public.invite_status
    AND user_id = (SELECT auth.uid())
    AND private.auth_email_is_verified()
  );

CREATE OR REPLACE FUNCTION private.guard_trip_collaborator_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $guard$
DECLARE
  v_uid uuid := auth.uid();
  v_is_owner boolean := false;
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Collaboration update requires authentication'
      USING ERRCODE = '42501';
  END IF;

  IF ROW(NEW.id, NEW.trip_id, NEW.invited_email, NEW.invited_by,
         NEW.invite_token, NEW.invite_sent_at, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.trip_id, OLD.invited_email, OLD.invited_by,
         OLD.invite_token, OLD.invite_sent_at, OLD.created_at) THEN
    RAISE EXCEPTION 'Invitation identity fields are immutable'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = OLD.trip_id AND owner_id = v_uid
  ) INTO v_is_owner;

  IF v_is_owner THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
       OR NEW.role NOT IN ('viewer', 'editor')
       OR (NEW.status IS DISTINCT FROM OLD.status
           AND NEW.status <> 'revoked'::public.invite_status) THEN
      RAISE EXCEPTION 'Trip owner may only adjust role or revoke invitation'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending'::public.invite_status
     AND OLD.user_id IS NULL
     AND private.auth_email_is_verified()
     AND lower(OLD.invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     AND NEW.status = 'accepted'::public.invite_status
     AND NEW.user_id = v_uid
     AND NEW.accepted_at IS NOT NULL
     AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invitation update not authorised'
    USING ERRCODE = '42501';
END;
$guard$;

REVOKE ALL ON FUNCTION private.guard_trip_collaborator_update()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_trip_collaborator_update ON public.trip_collaborators;
CREATE TRIGGER guard_trip_collaborator_update
  BEFORE UPDATE ON public.trip_collaborators
  FOR EACH ROW EXECUTE FUNCTION private.guard_trip_collaborator_update();

COMMIT;
