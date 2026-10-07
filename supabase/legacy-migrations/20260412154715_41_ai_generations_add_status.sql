
-- ============================================================================
-- Adds a three-state status column to ai_generations for race-condition-safe
-- rate limiting. The existing `success` boolean column is preserved for
-- backward compatibility with the Session 5 logging code.
--
-- status values:
--   'pending' — row inserted BEFORE calling Claude. Counts toward the limit.
--               Protects against concurrent request abuse (see Part 3 of the
--               review fixes prompt).
--   'success' — row updated AFTER a successful Claude response. Counts toward
--               the limit.
--   'failed'  — row updated AFTER a failed Claude response. Does NOT count
--               toward the limit (so users can retry without penalty).
--
-- The limit check queries WHERE status IN ('pending', 'success').
-- ============================================================================

-- Add the new column with a sensible default for existing rows
alter table ai_generations
  add column if not exists status text not null default 'success'
  check (status in ('pending', 'success', 'failed'));

-- Backfill: existing rows with success = false should be marked 'failed'
-- so they don't wrongly count toward user limits
update ai_generations
set status = 'failed'
where success = false
  and status = 'success';  -- only update the default-set ones, don't clobber

comment on column ai_generations.status is
  'Lifecycle state: pending (reserved pre-Claude-call), success (Claude succeeded), failed (Claude failed or was aborted). The rate limit counts pending + success rows.';

-- Helpful index for the rate limit query
create index if not exists ai_generations_trip_status_idx
  on ai_generations (trip_id, status)
  where status in ('pending', 'success');
;
