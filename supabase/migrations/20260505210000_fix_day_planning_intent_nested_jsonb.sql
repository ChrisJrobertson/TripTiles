-- Nested jsonb_set: create_missing=true only creates the leaf segment, not intermediate parents such as ai_day_intent.
create or replace function public.set_trip_day_planning_intent(
  p_trip_id uuid,
  p_user_id uuid,
  p_date   text,
  p_intent jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  rows_updated   int;
  updated_intent jsonb;
begin
  if p_user_id is null then
    raise exception 'Missing user id';
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
$function$;
