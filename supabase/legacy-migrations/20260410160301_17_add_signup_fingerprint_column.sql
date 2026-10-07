
-- Add a soft fingerprint column to profiles for measuring (not blocking)
-- multi-account behaviour. Populated by the signup flow in a future session.
-- 
-- This is intentionally NOT used for enforcement. It's a data point only.
-- We can query it to understand what % of users are creating duplicate
-- accounts, which helps us decide future product strategy.
--
-- The hash is generated client-side from non-PII signals like user agent,
-- screen resolution, timezone, language. It's not a stable identifier and
-- can change if the user clears cookies or switches devices.

alter table profiles 
add column if not exists signup_fingerprint text,
add column if not exists signup_ip_country text;

-- Index for querying duplicates efficiently  
create index if not exists idx_profiles_fingerprint 
  on profiles(signup_fingerprint) 
  where signup_fingerprint is not null;

comment on column profiles.signup_fingerprint is 
  'Soft fingerprint hash from signup. Used for measurement only, not enforcement. Can be null.';
comment on column profiles.signup_ip_country is 
  'ISO country code from signup IP. Used for analytics and tax/region detection.';
;
