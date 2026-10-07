
-- ============================================================================
-- Defensive INSERT policy on purchases
-- 
-- Cursor's webhook uses the service_role client which bypasses RLS, so this
-- isn't strictly required today. But it's good practice:
-- 1. Protects against accidental code changes that switch to authenticated client
-- 2. Lets server actions insert purchases (e.g. for manual test data) without
--    needing service role
-- 3. Matches the pattern on ai_generations and custom_tiles
--
-- Policy: a user can only insert a purchase row where user_id matches their own
-- auth.uid(). Service role bypasses this check entirely.
-- ============================================================================

create policy "Purchases insert own"
  on purchases for insert 
  with check (user_id = (select auth.uid()));
;
