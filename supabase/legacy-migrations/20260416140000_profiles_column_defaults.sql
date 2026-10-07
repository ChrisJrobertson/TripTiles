-- -----------------------------------------------------------------------------
-- Defense in depth: NOT NULL columns without DEFAULTs break any INSERT that omits
-- them (including handle_new_user if it falls out of sync with the live table).
-- Set defaults where missing so inserts remain valid even if the trigger lists drift.
-- Idempotent: only ALTER when information_schema reports no column_default.
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'profiles'
      and c.column_name = 'referral_code'
      and c.column_default is null
  ) then
    alter table public.profiles
      alter column referral_code
      set default lower(replace(gen_random_uuid()::text, '-', ''));
  end if;

  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'profiles'
      and c.column_name = 'created_at'
      and c.column_default is null
  ) then
    alter table public.profiles
      alter column created_at set default now();
  end if;

  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'profiles'
      and c.column_name = 'updated_at'
      and c.column_default is null
  ) then
    alter table public.profiles
      alter column updated_at set default now();
  end if;

  if exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'profiles'
      and c.column_name = 'tier'
      and c.column_default is null
  ) then
    alter table public.profiles
      alter column tier set default 'free'::public.user_tier;
  end if;
end $$;
