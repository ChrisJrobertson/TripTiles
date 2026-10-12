-- SECURITY DEFINER trip RPCs bypass RLS. They previously trusted a client-supplied
-- user id. Require that id to be the authenticated caller so one user cannot
-- write another user's trip by passing a foreign owner id.

create or replace function public.set_trip_day_planning_intent(
  p_trip_id uuid,
  p_user_id uuid,
  p_date text,
  p_intent jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rows_updated   int;
  updated_intent jsonb;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'Trip not found or not authorised'
      using errcode = '42501';
  end if;

  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid date format. Expected YYYY-MM-DD.';
  end if;

  update public.trips
  set preferences = jsonb_set(
        jsonb_set(
          coalesce(preferences, '{}'::jsonb),
          array['ai_day_intent'],
          coalesce(preferences -> 'ai_day_intent', '{}'::jsonb),
          true
        ),
        array['ai_day_intent', p_date],
        p_intent,
        true
      ),
      updated_at = now()
  where id = p_trip_id
    and owner_id = p_user_id
  returning preferences -> 'ai_day_intent' -> p_date into updated_intent;

  get diagnostics rows_updated = row_count;

  if rows_updated = 0 then
    raise exception 'Trip not found or not authorised'
      using errcode = '42501';
  end if;

  return updated_intent;
end;
$$;

create or replace function public.save_trip_planning_profile(
  p_trip_id uuid,
  p_user_id uuid,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rows_updated int;
  updated_profile jsonb;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'Trip not found or not authorised'
      using errcode = '42501';
  end if;

  if p_profile is null or jsonb_typeof(p_profile) != 'object' then
    raise exception 'Profile must be a JSON object';
  end if;

  update public.trips
  set
    preferences = jsonb_set(
      coalesce(preferences, '{}'::jsonb),
      '{trip_planning_profile}',
      p_profile,
      true
    ),
    updated_at = now()
  where id = p_trip_id
    and owner_id = p_user_id
  returning preferences -> 'trip_planning_profile' into updated_profile;

  get diagnostics rows_updated = row_count;

  if rows_updated = 0 then
    raise exception 'Trip not found or not authorised'
      using errcode = '42501';
  end if;

  return updated_profile;
end;
$$;

create or replace function public.save_day_plan_feedback(
  p_trip_id uuid,
  p_user_id uuid,
  p_date text,
  p_feedback jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rows_updated    int;
  updated_feedback jsonb;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'Trip not found or not authorised'
      using errcode = '42501';
  end if;

  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid date format. Expected YYYY-MM-DD.';
  end if;

  if p_feedback is null or jsonb_typeof(p_feedback) != 'object' then
    raise exception 'Feedback must be a JSON object';
  end if;

  update public.trips
  set preferences = jsonb_set(
        jsonb_set(
          coalesce(preferences, '{}'::jsonb),
          array['day_plan_feedback'],
          coalesce(preferences -> 'day_plan_feedback', '{}'::jsonb),
          true
        ),
        array['day_plan_feedback', p_date],
        p_feedback,
        true
      ),
      updated_at = now()
  where id = p_trip_id
    and owner_id = p_user_id
  returning preferences -> 'day_plan_feedback' -> p_date into updated_feedback;

  get diagnostics rows_updated = row_count;

  if rows_updated = 0 then
    raise exception 'Trip not found or not authorised'
      using errcode = '42501';
  end if;

  return updated_feedback;
end;
$$;

create or replace function public.append_trip_behaviour_signal(
  p_trip_id uuid,
  p_user_id uuid,
  p_signal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rows_updated int;
  next_signals jsonb;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'Trip not found or not authorised'
      using errcode = '42501';
  end if;

  if p_signal is null or jsonb_typeof(p_signal) != 'object' then
    raise exception 'Signal must be a JSON object';
  end if;

  update public.trips
  set
    preferences = jsonb_set(
      coalesce(preferences, '{}'::jsonb),
      '{behaviour_signals}',
      coalesce(preferences -> 'behaviour_signals', '[]'::jsonb) || jsonb_build_array(p_signal),
      true
    ),
    updated_at = now()
  where id = p_trip_id
    and owner_id = p_user_id
  returning preferences -> 'behaviour_signals' into next_signals;

  get diagnostics rows_updated = row_count;

  if rows_updated = 0 then
    raise exception 'Trip not found or not authorised'
      using errcode = '42501';
  end if;

  return next_signals;
end;
$$;

revoke all on function public.set_trip_day_planning_intent(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.save_trip_planning_profile(uuid, uuid, jsonb) from public, anon;
revoke all on function public.save_day_plan_feedback(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.append_trip_behaviour_signal(uuid, uuid, jsonb) from public, anon;

grant execute on function public.set_trip_day_planning_intent(uuid, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.save_trip_planning_profile(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.save_day_plan_feedback(uuid, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.append_trip_behaviour_signal(uuid, uuid, jsonb) to authenticated, service_role;
