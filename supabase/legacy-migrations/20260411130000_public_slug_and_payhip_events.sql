-- Unique public slugs for share links; idempotent Payhip webhook processing.
create unique index if not exists trips_public_slug_unique
  on public.trips (public_slug)
  where public_slug is not null;

create table if not exists public.payhip_webhook_events (
  id text primary key,
  received_at timestamptz not null default now(),
  event_type text,
  email text
);

alter table public.payhip_webhook_events enable row level security;

revoke all on public.payhip_webhook_events from anon, authenticated;

-- Service role (used by /api/webhooks/payhip) bypasses RLS and can insert.
