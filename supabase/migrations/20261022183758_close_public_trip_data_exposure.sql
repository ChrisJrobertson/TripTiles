-- Close anonymous access to private trip data.
--
-- Confirmed exposure: when trips.is_public is true, the anonymous role could
-- SELECT the full trips row (notes, child_ages, preferences.day_notes, owner_id)
-- and related trip_payments / trip_ride_priorities rows, including payment
-- labels and ride notes. RLS filters rows, not columns, so a public SELECT
-- policy on the base table publishes every column PostgREST is granted.
--
-- Public pages now read an allowlisted projection through the service role
-- after checking is_public and the requested slug or id
-- (src/lib/public-trip-contract.ts, src/lib/db/public-trip-read.ts).
--
-- No catalogue rows change. No CHECK constraints change. No DELETE/INSERT.
-- Preflight: this migration changes policies and grants only.
-- Expected policies removed:
--   "Trips select own, collaborator, or public"
--   "Public trips ride priorities are readable"
--   trip_payments_public_select
-- Expected policy added:
--   "Trips select own or collaborator"
--
-- ROLLBACK (re-opens the exposure; do not apply unless restoring the old
-- behaviour on purpose):
--
--   DROP POLICY IF EXISTS "Trips select own or collaborator" ON public.trips;
--   CREATE POLICY "Trips select own, collaborator, or public"
--     ON public.trips FOR SELECT
--     USING (
--       (is_public = true)
--       OR (owner_id = (SELECT auth.uid()))
--       OR private.is_accepted_collaborator(id)
--     );
--   CREATE POLICY "Public trips ride priorities are readable"
--     ON public.trip_ride_priorities FOR SELECT
--     USING (trip_id IN (SELECT trips.id FROM public.trips WHERE trips.is_public = true));
--   CREATE POLICY trip_payments_public_select
--     ON public.trip_payments FOR SELECT
--     USING (trip_id IN (SELECT trips.id FROM public.trips WHERE trips.is_public = true));
--   GRANT ALL ON TABLE public.trips TO anon;
--   GRANT ALL ON TABLE public.trip_payments TO anon;
--   GRANT ALL ON TABLE public.trip_ride_priorities TO anon;
--   GRANT ALL ON TABLE public.trip_budget_items TO anon;
--   GRANT ALL ON TABLE public.trip_checklist_items TO anon;
--   GRANT ALL ON TABLE public.trip_collaborators TO anon;
--   GRANT ALL ON TABLE public.trip_day_templates TO anon;
--   GRANT ALL ON TABLE public.trip_reminders TO anon;
--   GRANT ALL ON TABLE public.profiles TO anon;
--   GRANT ALL ON TABLE public.custom_tiles TO anon;
--   GRANT ALL ON TABLE public.email_queue TO anon;
--   GRANT ALL ON TABLE public.purchases TO anon;
--   GRANT ALL ON TABLE public.ai_generations TO anon;
--   GRANT ALL ON TABLE public.achievements TO anon;
--   GRANT ALL ON TABLE public.affiliate_clicks TO anon;
--   GRANT ALL ON TABLE public.agencies TO anon;
--   GRANT ALL ON TABLE public.stripe_webhook_events TO anon;
--   GRANT ALL ON TABLE public.import_batches TO anon;

DROP POLICY IF EXISTS "Trips select own, collaborator, or public" ON public.trips;
DROP POLICY IF EXISTS "Trips select own or collaborator" ON public.trips;

CREATE POLICY "Trips select own or collaborator"
  ON public.trips
  FOR SELECT
  USING (
    (owner_id = (SELECT auth.uid()))
    OR private.is_accepted_collaborator(id)
  );

DROP POLICY IF EXISTS "Public trips ride priorities are readable" ON public.trip_ride_priorities;
DROP POLICY IF EXISTS trip_payments_public_select ON public.trip_payments;

REVOKE ALL ON TABLE public.trips FROM anon;
REVOKE ALL ON TABLE public.trip_payments FROM anon;
REVOKE ALL ON TABLE public.trip_ride_priorities FROM anon;
REVOKE ALL ON TABLE public.trip_budget_items FROM anon;
REVOKE ALL ON TABLE public.trip_checklist_items FROM anon;
REVOKE ALL ON TABLE public.trip_collaborators FROM anon;
REVOKE ALL ON TABLE public.trip_day_templates FROM anon;
REVOKE ALL ON TABLE public.trip_reminders FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.custom_tiles FROM anon;
REVOKE ALL ON TABLE public.email_queue FROM anon;
REVOKE ALL ON TABLE public.purchases FROM anon;
REVOKE ALL ON TABLE public.ai_generations FROM anon;
REVOKE ALL ON TABLE public.achievements FROM anon;
REVOKE ALL ON TABLE public.affiliate_clicks FROM anon;
REVOKE ALL ON TABLE public.agencies FROM anon;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM anon;
REVOKE ALL ON TABLE public.import_batches FROM anon;
