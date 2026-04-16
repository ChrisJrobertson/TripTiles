
create table parks (
  id text primary key,
  name text not null,
  icon text,
  bg_colour text not null,
  fg_colour text not null,
  park_group text not null,
  destinations destination[] not null,
  country text,
  latitude numeric,
  longitude numeric,
  official_url text,
  affiliate_hotel_query text,
  affiliate_ticket_url text,
  is_custom boolean default false,
  created_by uuid references profiles(id),
  agency_id uuid references agencies(id) on delete cascade,
  sort_order int default 100,
  created_at timestamptz default now()
);

create index idx_parks_group on parks(park_group);
create index idx_parks_destinations on parks using gin(destinations);
create index idx_parks_agency on parks(agency_id) where agency_id is not null;

create table email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  template text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text default 'queued',
  error text,
  created_at timestamptz default now()
);

create index idx_email_queue_scheduled on email_queue(scheduled_for) where status = 'queued';
create index idx_email_queue_user on email_queue(user_id);

create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  prompt text not null,
  model text not null default 'claude-haiku',
  input_tokens int,
  output_tokens int,
  cost_gbp_pence int,
  success boolean default true,
  error text,
  created_at timestamptz default now()
);

create index idx_ai_user_date on ai_generations(user_id, created_at);
;
