-- 1. Allow 'stripe' in provider constraint
alter table purchases drop constraint if exists purchases_provider_check;
alter table purchases add constraint purchases_provider_check
  check (provider in ('payhip', 'stripe'));
-- NOTE: 'payhip' stays allowed in the constraint because legacy purchases
-- rows (if any future user imports historical data) must still be valid.
-- But NEW purchases will always be 'stripe'. The Payhip route is deleted
-- in PART 3 so no new 'payhip' rows can be created.

-- 2. Add Stripe-specific subscription tracking columns
alter table purchases add column if not exists subscription_status text;
alter table purchases add column if not exists subscription_period_end timestamptz;
alter table purchases add column if not exists billing_interval text;

alter table purchases drop constraint if exists purchases_subscription_status_check;
alter table purchases add constraint purchases_subscription_status_check
  check (subscription_status is null or subscription_status in (
    'trialing', 'active', 'past_due', 'canceled',
    'incomplete', 'incomplete_expired', 'unpaid', 'paused'
  ));

alter table purchases drop constraint if exists purchases_billing_interval_check;
alter table purchases add constraint purchases_billing_interval_check
  check (billing_interval is null or billing_interval in ('month', 'year'));

-- 3. Profile tier expiry (for cancelled subscriptions still in paid period)
alter table profiles add column if not exists tier_expires_at timestamptz;

create index if not exists idx_profiles_tier_expires_at
  on profiles(tier_expires_at)
  where tier_expires_at is not null;

-- 4. Stripe webhook idempotency log
drop table if exists stripe_webhook_events;
create table stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);
alter table stripe_webhook_events enable row level security;
-- No policies = service-role-only access (intentional — only webhook
-- handler writes here)

-- 5. Drop the Payhip idempotency table (zero rows, no longer needed)
drop table if exists payhip_webhook_events;
