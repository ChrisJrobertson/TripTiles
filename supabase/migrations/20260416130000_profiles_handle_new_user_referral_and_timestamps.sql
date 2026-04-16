-- -----------------------------------------------------------------------------
-- Follow-up to 20260415140000: backfill INSERT failed when profiles has NOT NULL
-- columns without defaults (typically referral_code). New signups would hit the
-- same issue in handle_new_user.
--
-- This replaces handle_new_user and re-runs the orphan backfill with:
--   - referral_code: unique-ish token from UUID (32 hex chars; adjust if column is shorter)
--   - created_at / updated_at: now() when those columns exist and lack defaults
--
-- If this still fails, run scripts/sql/diagnostic_profiles_not_null_no_default.sql
-- and add any remaining NOT NULL columns to the INSERT lists below.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rc text;
begin
  rc := lower(replace(gen_random_uuid()::text, '-', ''));

  insert into public.profiles (
    id,
    email,
    tier,
    referral_code,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    'free'::public.user_tier,
    rc,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

insert into public.profiles (
  id,
  email,
  tier,
  referral_code,
  created_at,
  updated_at
)
select
  u.id,
  u.email,
  'free'::public.user_tier,
  lower(replace(gen_random_uuid()::text, '-', '')),
  now(),
  now()
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
