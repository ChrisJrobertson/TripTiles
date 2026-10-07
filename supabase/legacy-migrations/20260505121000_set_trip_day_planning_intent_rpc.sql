-- Atomic write for `trips.preferences.ai_day_intent[date]` without replacing unrelated keys.

create or replace function public.set_trip_day_planning_intent(
  p_trip_id uuid,
  p_date text,
  p_intent jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_intent jsonb;
begin
  if p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid date format. Expected YYYY-MM-DD.';
  end if;

  update public.trips
  set
    preferences = jsonb_set(
      coalesce(preferences, '{}'::jsonb),
      array['ai_day_intent', p_date],
      p_intent,
      true
    ),
    updated_at = now()
  where id = p_trip_id
    and owner_id = auth.uid()
  returning preferences -> 'ai_day_intent' -> p_date into updated_intent;

  return updated_intent;
end;
$$;

grant execute on function public.set_trip_day_planning_intent(uuid, text, jsonb)
to authenticated;

