-- Trip Intelligence Layer: JSONB under trips.preferences (SECURITY DEFINER + explicit owner check).

create or replace function public.save_trip_planning_profile(
  p_trip_id uuid,
  p_user_id uuid,
  p_profile jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  rows_updated int;
  updated_profile jsonb;
begin
  if p_user_id is null then
    raise exception 'Missing user id';
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
$function$;

create or replace function public.save_day_plan_feedback(
  p_trip_id uuid,
  p_user_id uuid,
  p_date text,
  p_feedback jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  rows_updated    int;
  updated_feedback jsonb;
begin
  if p_user_id is null then
    raise exception 'Missing user id';
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
$function$;

create or replace function public.append_trip_behaviour_signal(
  p_trip_id uuid,
  p_user_id uuid,
  p_signal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  rows_updated int;
  next_signals jsonb;
begin
  if p_user_id is null then
    raise exception 'Missing user id';
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
$function$;

revoke execute on function public.save_trip_planning_profile(uuid, uuid, jsonb) from public;
grant execute on function public.save_trip_planning_profile(uuid, uuid, jsonb) to authenticated;

revoke execute on function public.save_day_plan_feedback(uuid, uuid, text, jsonb) from public;
grant execute on function public.save_day_plan_feedback(uuid, uuid, text, jsonb) to authenticated;

revoke execute on function public.append_trip_behaviour_signal(uuid, uuid, jsonb) from public;
grant execute on function public.append_trip_behaviour_signal(uuid, uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
