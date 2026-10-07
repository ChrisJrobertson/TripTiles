
-- ============================================================================
-- UK HMRC TAX COMPLIANCE FIX
--
-- HMRC requires self-employed individuals to retain financial records for at
-- least 5 years after the January 31 submission deadline for that tax year.
-- The previous cascade behaviour destroyed purchase records when a user
-- deleted their account, which would have put us in non-compliance.
--
-- Fix:
--   1. Change the FK from CASCADE to SET NULL so purchase rows survive
--      even after account deletion.
--   2. Alter the user_id column to allow NULL (for post-deletion state).
--   3. Anonymisation of PII in metadata happens in the deleteAccountAction
--      code path (separate Cursor prompt).
-- ============================================================================

-- Drop the existing CASCADE constraint
alter table purchases 
  drop constraint purchases_user_id_fkey;

-- Allow user_id to be null (for anonymised post-deletion rows)
alter table purchases 
  alter column user_id drop not null;

-- Re-add the FK with ON DELETE SET NULL
alter table purchases
  add constraint purchases_user_id_fkey
  foreign key (user_id)
  references profiles(id)
  on delete set null;

-- RLS update: users can still see their own purchases, but anonymous 
-- (user_id = null) rows are invisible to all except service_role
drop policy if exists "Purchases select own" on purchases;

create policy "Purchases select own"
  on purchases for select
  using (user_id = (select auth.uid()));

comment on table purchases is
  'Financial records retained per UK HMRC requirements (5+ years). On account deletion, user_id is set to NULL and PII is anonymised but the transaction record is preserved.';

comment on column purchases.user_id is
  'References profiles(id). ON DELETE SET NULL so that account deletion does not destroy the financial record. NULL means the original purchaser has deleted their account.';
;
