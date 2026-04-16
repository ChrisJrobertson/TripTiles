
-- ============================================================================
-- Harden RLS for Session 6 (Payments):
-- 
-- 1. payhip_webhook_events has RLS enabled but no policies - webhook inserts
--    from the service_role will work regardless, but we want to ensure
--    regular authenticated users can NEVER read webhook event data (it may
--    contain other users' email addresses etc).
--
-- 2. purchases already has a SELECT policy (own rows only) which is correct.
--    We leave INSERT without a policy because only the webhook handler
--    inserts here, and it uses the service_role client which bypasses RLS.
-- ============================================================================

-- Service role can do anything with webhook events (webhooks run as service role)
-- Authenticated users get ZERO access to this table
create policy "Service role only for webhook events"
  on payhip_webhook_events
  for all
  using (false)
  with check (false);
-- Note: this policy evaluates to false for any non-superuser,
-- which means authenticated/anon users can't read/insert/update/delete
-- The service_role bypasses RLS entirely so webhook handler works fine

comment on table payhip_webhook_events is 
  'Idempotency log for Payhip webhook events. Only writable via service_role. Never readable by end users.';
;
