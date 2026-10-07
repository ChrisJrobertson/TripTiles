-- Stripe subscription mirror + Tripp usage logging + trip archive flags + profile Stripe id.

create table if not exists public.stripe_webhook_events (
  id text primary key,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null,
  tier text not null check (tier in ('navigator', 'captain')),
  price_id text not null,
  current_period_end timestamptz,
  payment_status text,
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_subscriptions_user_id on public.user_subscriptions (user_id);
create index if not exists idx_user_subscriptions_status on public.user_subscriptions (status);

drop trigger if exists user_subscriptions_updated_at on public.user_subscriptions;
create trigger user_subscriptions_updated_at
  before update on public.user_subscriptions
  for each row execute function public.update_updated_at();

alter table public.user_subscriptions enable row level security;

drop policy if exists user_subscriptions_select_own on public.user_subscriptions;
create policy user_subscriptions_select_own
  on public.user_subscriptions for select
  using (user_id = (select auth.uid()));

-- Inserts/updates come from the Stripe webhook (service role) only.

create table if not exists public.tripp_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  latency_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_tripp_usage_user_id on public.tripp_usage (user_id);
create index if not exists idx_tripp_usage_created_at on public.tripp_usage (created_at desc);

alter table public.tripp_usage enable row level security;

drop policy if exists tripp_usage_select_own on public.tripp_usage;
create policy tripp_usage_select_own
  on public.tripp_usage for select
  using (user_id = (select auth.uid()));

drop policy if exists tripp_usage_insert_own on public.tripp_usage;
create policy tripp_usage_insert_own
  on public.tripp_usage for insert
  with check (user_id = (select auth.uid()));

alter table public.profiles
  add column if not exists stripe_customer_id text;

alter table public.trips
  add column if not exists is_archived boolean not null default false;

alter table public.trips
  add column if not exists archived_reason text;

create index if not exists idx_trips_owner_active
  on public.trips (owner_id)
  where is_archived = false;
