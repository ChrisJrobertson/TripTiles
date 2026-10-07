-- Realign public.stripe_webhook_events to the webhook handler contract:
--   id = Stripe event id (text PK)
--   received_at = when we first saw the event
-- Safe to apply on fresh DB, post-hotfix prod, or legacy drift (event_id / event_type / processed_at).

-- 1) Base table (matches handler insert: { id }, default received_at)
create table if not exists public.stripe_webhook_events (
  id text primary key,
  received_at timestamptz not null default now()
);

-- 2) Legacy rename: only when old column is event_id and id is absent
do $migration$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_webhook_events'
      and column_name = 'event_id'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_webhook_events'
      and column_name = 'id'
  ) then
    execute 'alter table public.stripe_webhook_events rename column event_id to id';
  end if;
end
$migration$;

-- 3) If both id and event_id exist (rare), merge and drop event_id
do $migration$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_webhook_events'
      and column_name = 'event_id'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_webhook_events'
      and column_name = 'id'
  ) then
    update public.stripe_webhook_events
    set id = coalesce(nullif(trim(id), ''), event_id)
    where id is null or id = '';
    execute 'alter table public.stripe_webhook_events drop column event_id';
  end if;
end
$migration$;

-- 4) Ensure id column exists
alter table public.stripe_webhook_events
  add column if not exists id text;

-- 5) received_at: add, backfill from processed_at if that column ever existed, then set default + not null
alter table public.stripe_webhook_events
  add column if not exists received_at timestamptz;

do $migration$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_webhook_events'
      and column_name = 'processed_at'
  ) then
    update public.stripe_webhook_events
    set received_at = coalesce(received_at, processed_at, now());
  else
    update public.stripe_webhook_events
    set received_at = coalesce(received_at, now())
    where received_at is null;
  end if;
end
$migration$;

alter table public.stripe_webhook_events
  alter column received_at set default now();

update public.stripe_webhook_events
set received_at = now()
where received_at is null;

alter table public.stripe_webhook_events
  alter column received_at set not null;

-- 6) Drop legacy columns (safe when empty; if rows exist, id/received_at already set above)
alter table public.stripe_webhook_events
  drop column if exists event_type;

alter table public.stripe_webhook_events
  drop column if exists processed_at;

-- 7) Enforce primary key on id (add only if missing)
do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'stripe_webhook_events_pkey'
      and conrelid = 'public.stripe_webhook_events'::regclass
  ) then
    -- fail fast if duplicate or null ids remain
    execute 'alter table public.stripe_webhook_events add constraint stripe_webhook_events_pkey primary key (id)';
  end if;
end
$migration$;

-- 8) RLS: enabled; no policies (service role + admin bypass for webhook)
alter table public.stripe_webhook_events enable row level security;

comment on table public.stripe_webhook_events is
  'Idempotency log for incoming Stripe webhook events, keyed by event.id. Service role only; no RLS policies required.';

notify pgrst, 'reload schema';
