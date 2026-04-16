
-- Enums
create type user_tier as enum ('free', 'pro', 'family', 'concierge', 'agent_staff', 'agent_admin');
create type trip_status as enum ('draft', 'planning', 'booked', 'in_progress', 'completed', 'archived');
create type destination as enum ('orlando', 'paris', 'tokyo', 'cali', 'cruise', 'custom');
create type slot_type as enum ('am', 'pm', 'lunch', 'dinner');
create type concierge_status as enum ('pending', 'in_progress', 'ready_for_review', 'delivered', 'refunded');
create type invite_status as enum ('pending', 'accepted', 'declined', 'revoked');

-- Updated_at helper (used by multiple tables)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Profiles table
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  tier user_tier not null default 'free',
  agency_id uuid,
  marketing_opt_in boolean default false,
  referral_code text unique,
  referred_by uuid references profiles(id),
  currency text default 'GBP',
  locale text default 'en-GB',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_profiles_agency on profiles(agency_id) where agency_id is not null;
create index idx_profiles_tier on profiles(tier);
create index idx_profiles_referral on profiles(referral_code) where referral_code is not null;

create trigger profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, referral_code)
  values (
    new.id,
    new.email,
    'tt-' || substr(md5(random()::text), 1, 6)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
;
