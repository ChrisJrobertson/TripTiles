-- READ-ONLY assertions after applying the review hardening SQL on LOCAL/staging.
WITH checks (test_name, expected_result) AS (
  VALUES
  ('profiles: tier not writable',
     NOT has_column_privilege('authenticated','public.profiles','tier','UPDATE')),
  ('profiles: tier expiry not writable',
     NOT has_column_privilege('authenticated','public.profiles','tier_expires_at','UPDATE')),
  ('profiles: agency ID not writable',
     NOT has_column_privilege('authenticated','public.profiles','agency_id','UPDATE')),
  ('profiles: stripe customer not writable',
     NOT has_column_privilege('authenticated','public.profiles','stripe_customer_id','UPDATE')),
  ('profiles: stripe subscription not writable',
     NOT has_column_privilege('authenticated','public.profiles','stripe_subscription_id','UPDATE')),
  ('profiles: AI lifetime count not writable',
     NOT has_column_privilege('authenticated','public.profiles','ai_generations_lifetime','UPDATE')),
  ('profiles: display name writable',
     has_column_privilege('authenticated','public.profiles','display_name','UPDATE')),
  ('profiles: preferences writable',
     has_column_privilege('authenticated','public.profiles','preferences','UPDATE')),
  ('purchases: not insertable',
     NOT has_table_privilege('authenticated','public.purchases','INSERT')),
  ('purchases: not modifiable',
     NOT has_table_privilege('authenticated','public.purchases','UPDATE')),
  ('purchases: still readable (subject to RLS)',
     has_table_privilege('authenticated','public.purchases','SELECT')),
  ('agencies: subscription plan not writable',
     NOT has_column_privilege('authenticated','public.agencies','subscription_plan','UPDATE')),
  ('agencies: subscription status not writable',
     NOT has_column_privilege('authenticated','public.agencies','subscription_status','UPDATE')),
  ('agencies: seat cap not writable',
     NOT has_column_privilege('authenticated','public.agencies','max_seats','UPDATE')),
  ('agencies: name writable (subject to RLS)',
     has_column_privilege('authenticated','public.agencies','name','UPDATE')),
  ('collaborators: role grant retained (guarded by trigger)',
     has_column_privilege('authenticated','public.trip_collaborators','role','UPDATE')),
  ('collaborators: trip ID not writable',
     NOT has_column_privilege('authenticated','public.trip_collaborators','trip_id','UPDATE')),
  ('collaborators: owner/invitee policies exist',
     (SELECT count(*)=2 FROM pg_policies
      WHERE schemaname='public' AND tablename='trip_collaborators'
        AND policyname IN (
           'Collaborators update by trip owner',
           'Collaborators accept matching pending invite'
        ))),
  ('collaborators: guard trigger enabled',
     EXISTS (
       SELECT 1 FROM pg_trigger t
       JOIN pg_class c ON c.oid=t.tgrelid
       JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname='trip_collaborators'
         AND t.tgname='guard_trip_collaborator_update'
         AND t.tgenabled <> 'D'
     )),
  ('anon cannot select trips',
     NOT has_table_privilege('anon','public.trips','SELECT')),
  ('service_role can execute increment rpc',
     has_function_privilege(
       'service_role',
       'public.increment_ai_generations_lifetime(uuid)',
       'EXECUTE'
     )),
  ('authenticated cannot execute increment rpc',
     NOT has_function_privilege(
       'authenticated',
       'public.increment_ai_generations_lifetime(uuid)',
       'EXECUTE'
     )),
  ('22 Oct trips select policy present',
     EXISTS (
       SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='trips'
         AND policyname='Trips select own or collaborator'
     ))
)
SELECT test_name, expected_result,
       CASE WHEN expected_result THEN 'PASS' ELSE 'FAIL' END AS status
FROM checks ORDER BY test_name;
