
create table concierge_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  trip_id uuid references trips(id) on delete set null,
  purchase_id uuid references purchases(id),
  trip_start date not null,
  trip_end date not null,
  adults int not null,
  children int not null,
  child_ages int[] default array[]::int[],
  budget_gbp int,
  must_do_parks text[],
  must_do_rides text,
  dietary_requirements text,
  mobility_needs text,
  special_occasions text,
  free_text_prompt text not null,
  status concierge_status not null default 'pending',
  assigned_to uuid references profiles(id),
  draft_plan jsonb,
  final_pdf_url text,
  zoom_link text,
  zoom_scheduled_at timestamptz,
  delivered_at timestamptz,
  customer_rating int check (customer_rating between 1 and 5),
  customer_feedback text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_concierge_status on concierge_requests(status);
create index idx_concierge_user on concierge_requests(user_id);
create trigger concierge_updated_at before update on concierge_requests
  for each row execute function update_updated_at();

create table affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  trip_id uuid references trips(id) on delete set null,
  provider text not null,
  product_type text not null,
  target_url text not null,
  tile_id text,
  session_id text,
  referrer text,
  user_agent text,
  ip_country text,
  clicked_at timestamptz default now()
);

create index idx_aff_clicks_user on affiliate_clicks(user_id) where user_id is not null;
create index idx_aff_clicks_trip on affiliate_clicks(trip_id) where trip_id is not null;
create index idx_aff_clicks_provider on affiliate_clicks(provider);
create index idx_aff_clicks_date on affiliate_clicks(clicked_at);

create table affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  click_id uuid references affiliate_clicks(id),
  provider text not null,
  provider_order_id text,
  product_type text not null,
  gross_value_gbp_pence int,
  commission_gbp_pence int,
  status text default 'pending',
  confirmed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_aff_conv_status on affiliate_conversions(status);
create index idx_aff_conv_provider on affiliate_conversions(provider);
;
