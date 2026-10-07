-- Harden public.handle_new_user so a profile-insert failure can never block auth signup.
--
-- Why: previously an exception inside the trigger (e.g. a future NOT NULL column
-- without a default) would roll back the auth.users insert and either fail signup
-- or leave an orphaned auth user with no profile. Wrapping the insert in an
-- exception handler guarantees signup always succeeds; a periodic backfill (and the
-- on-conflict upsert) heals any row that failed to insert.
--
-- Idempotent: CREATE OR REPLACE; safe to re-apply.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rc text;
begin
  rc := lower(replace(gen_random_uuid()::text, '-', ''));

  begin
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
  exception
    when others then
      -- Never block auth signup on a profile-insert failure; log and continue.
      raise warning 'handle_new_user: profile insert failed for % (%): %',
        new.id, new.email, sqlerrm;
  end;

  return new;
end;
$function$;

notify pgrst, 'reload schema';
