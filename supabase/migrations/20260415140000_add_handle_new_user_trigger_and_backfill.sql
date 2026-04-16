-- -----------------------------------------------------------------------------
-- Auth → profiles: trigger + orphan backfill
--
-- Repo migrations already add nullable / defaulted columns on profiles:
--   - temperature_unit NOT NULL default 'c' (20260412120000)
--   - email_marketing_opt_out NOT NULL default false (20260413120000)
--
-- If this migration fails with NOT NULL or missing column (e.g. referral_code),
-- inspect live `public.profiles` in the Table Editor and extend the INSERT lists
-- below with defaults for those columns, then re-run.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, tier)
  values (
    new.id,
    new.email,
    'free'::public.user_tier
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Orphans: auth users without a profile row (e.g. created before this trigger).
insert into public.profiles (id, email, tier)
select
  u.id,
  u.email,
  'free'::public.user_tier
from auth.users u
where u.id not in (select p.id from public.profiles p);
