-- Reorder a single ride priority within its (trip, day, priority) group.

create or replace function public.reorder_ride_priority(
  p_id uuid,
  p_new_sort_order int
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trip_id uuid;
  v_day_date date;
  v_priority ride_priority;
  v_current_sort int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select trip_id, day_date, priority, sort_order
  into v_trip_id, v_day_date, v_priority, v_current_sort
  from trip_ride_priorities
  where id = p_id;

  if v_trip_id is null then
    raise exception 'row not found';
  end if;

  if not exists (
    select 1 from trips tr
    where tr.id = v_trip_id
      and (
        tr.owner_id = v_uid
        or exists (
          select 1 from trip_collaborators tc
          where tc.trip_id = tr.id
            and tc.user_id = v_uid
            and tc.status = 'accepted'
            and tc.role = 'editor'
        )
      )
  ) then
    raise exception 'not authorised';
  end if;

  if p_new_sort_order = v_current_sort then
    return;
  end if;

  if p_new_sort_order > v_current_sort then
    update trip_ride_priorities
    set sort_order = sort_order - 1
    where trip_id = v_trip_id
      and day_date = v_day_date
      and priority = v_priority
      and sort_order > v_current_sort
      and sort_order <= p_new_sort_order;
  else
    update trip_ride_priorities
    set sort_order = sort_order + 1
    where trip_id = v_trip_id
      and day_date = v_day_date
      and priority = v_priority
      and sort_order >= p_new_sort_order
      and sort_order < v_current_sort;
  end if;

  update trip_ride_priorities
  set sort_order = p_new_sort_order
  where id = p_id;
end;
$$;

grant execute on function public.reorder_ride_priority(uuid, int) to authenticated;
