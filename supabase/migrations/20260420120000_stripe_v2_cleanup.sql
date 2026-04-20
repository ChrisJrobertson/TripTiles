-- Session 14 v2: consolidate Stripe subscription state into purchases table.
-- Drops the parallel user_subscriptions mirror and Tripp usage logging.
-- Adds profile / purchase columns used by the app (safe if already applied in prod).

alter table public.profiles
  add column if not exists tier_expires_at timestamptz;

alter table public.purchases
  add column if not exists subscription_status text,
  add column if not exists subscription_period_end timestamptz,
  add column if not exists billing_interval text,
  add column if not exists stripe_price_id text,
  add column if not exists updated_at timestamptz not null default now();

drop table if exists public.user_subscriptions cascade;

drop table if exists public.tripp_usage cascade;
