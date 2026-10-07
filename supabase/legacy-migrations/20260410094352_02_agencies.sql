
create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  primary_colour text default '#0B1E5C',
  accent_colour text default '#C9A961',
  contact_email text not null,
  contact_phone text,
  website text,
  subscription_status text default 'trial',
  subscription_plan text default 'starter',
  trial_ends_at timestamptz default (now() + interval '30 days'),
  current_period_end timestamptz,
  payhip_subscription_id text,
  max_seats int default 3,
  max_client_trips int default 50,
  booking_com_affiliate_id text,
  viator_affiliate_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_agencies_slug on agencies(slug);
create index idx_agencies_status on agencies(subscription_status);

create trigger agencies_updated_at before update on agencies
  for each row execute function update_updated_at();

alter table profiles
  add constraint profiles_agency_fk foreign key (agency_id) references agencies(id) on delete set null;
;
