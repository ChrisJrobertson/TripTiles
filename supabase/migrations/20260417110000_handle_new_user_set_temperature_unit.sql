-- Belt-and-suspenders: new profile rows explicitly set temperature_unit so signups
-- never depend on a column default being present in every environment.

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
    created_at,
    updated_at
  )
  values (
    new.id,
    new.email,
    'free'::public.user_tier,
    rc,
    'c',
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Orphans without temperature_unit (should be rare): backfill only where null would violate NOT NULL
update public.profiles p
set temperature_unit = 'c'
where p.temperature_unit is null;
