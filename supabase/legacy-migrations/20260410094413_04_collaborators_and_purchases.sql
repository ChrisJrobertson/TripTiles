
create table trip_collaborators (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references profiles(id),
  role text not null default 'editor',
  status invite_status not null default 'pending',
  invite_token text unique,
  invite_sent_at timestamptz default now(),
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create index idx_collab_trip on trip_collaborators(trip_id);
create index idx_collab_user on trip_collaborators(user_id);
create index idx_collab_token on trip_collaborators(invite_token) where invite_token is not null;
create unique index idx_collab_unique on trip_collaborators(trip_id, invited_email);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  product text not null,
  amount_gbp_pence int not null,
  currency text default 'GBP',
  provider text not null,
  provider_order_id text,
  provider_customer_id text,
  status text not null default 'completed',
  refunded_at timestamptz,
  discount_code_used text,
  affiliate_code text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_purchases_user on purchases(user_id);
create index idx_purchases_status on purchases(status);
create index idx_purchases_affiliate on purchases(affiliate_code) where affiliate_code is not null;
create unique index idx_purchases_provider_order on purchases(provider, provider_order_id) where provider_order_id is not null;
;
