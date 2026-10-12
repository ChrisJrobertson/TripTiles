
-- ============================================================================
-- The ai_generations table needs an INSERT policy so authenticated users
-- can log their own AI generation attempts (success or failure).
--
-- Without this, Cursor's generateAIPlanAction would either:
--   a) Silently fail to log generations if it uses the authenticated client
--   b) Be forced to use the service_role client, which bypasses ALL safety
--      checks and is risky for code that runs frequently
--
-- Adding the INSERT policy lets the action use the authenticated client
-- safely - users can only insert rows where user_id matches their own auth.uid
-- ============================================================================

-- Drop any existing insert policies (just in case there's a stale one)
drop policy if exists "AI generations insert own" on ai_generations;
drop policy if exists "Users can insert their own ai generations" on ai_generations;

-- Create the proper insert policy
create policy "AI generations insert own"
  on ai_generations for insert with check (
    user_id = (select auth.uid())
  );

-- Also enable UPDATE for the rare case the action wants to update an
-- existing generation row (e.g. patching a successful row with final
-- token counts after an async retry). Defensive but cheap.
create policy "AI generations update own"
  on ai_generations for update using (
    user_id = (select auth.uid())
  );
;
