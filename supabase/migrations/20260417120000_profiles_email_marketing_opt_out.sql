-- Production historically used marketing_opt_in; app + 20260413120000 use
-- email_marketing_opt_out (true = skip marketing emails). Add the column and
-- derive values from the legacy flag where present.

alter table public.profiles
  add column if not exists email_marketing_opt_out boolean not null default false;

-- marketing_opt_in true  → user wants marketing     → email_marketing_opt_out false
-- marketing_opt_in false → no opt-in to marketing  → email_marketing_opt_out true
update public.profiles
set email_marketing_opt_out = not coalesce(marketing_opt_in, false);

-- New signups: set explicitly alongside temperature_unit (see 20260417110000).
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
    temperature_unit,
    email_marketing_opt_out,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    'free'::public.user_tier,
    rc,
    'c',
    false,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
