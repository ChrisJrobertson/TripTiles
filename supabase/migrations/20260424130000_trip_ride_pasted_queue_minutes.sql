-- Optional "pasted" queue wait (minutes) from boards/apps — for Smart Plan context only, not live data.

alter table trip_ride_priorities
  add column if not exists pasted_queue_minutes integer;

alter table trip_ride_priorities
  drop constraint if exists trip_ride_priorities_pasted_queue_minutes_check;

alter table trip_ride_priorities
  add constraint trip_ride_priorities_pasted_queue_minutes_check
  check (pasted_queue_minutes is null or (pasted_queue_minutes >= 0 and pasted_queue_minutes <= 600));

-- duplicate_trip_day: copy pasted wait with return time
create or replace function public.duplicate_trip_day(
  p_trip_id uuid,
  p_source date,
  p_targets date[],
  p_merge text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_source_key text := to_char(p_source, 'YYYY-MM-DD');
  v_source_slot jsonb;
  v_source_note text;
  v_target date;
  v_target_key text;
  v_next_sort int;
  v_rec record;
  v_cur jsonb;
  v_slot text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from trips tr
    where tr.id = p_trip_id
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
    raise exception 'trip not found';
  end if;

  select
    assignments -> v_source_key,
    preferences -> 'day_notes' ->> v_source_key
  into v_source_slot, v_source_note
  from trips
  where id = p_trip_id;

  foreach v_target in array p_targets loop
    if v_target = p_source then
      continue;
    end if;

    v_target_key := to_char(v_target, 'YYYY-MM-DD');

    if p_merge = 'replace' then
      delete from trip_ride_priorities
      where trip_id = p_trip_id and day_date = v_target;

      update trips
      set
        assignments = coalesce(assignments, '{}'::jsonb) - v_target_key,
        preferences = case
          when preferences ? 'day_notes' then
            jsonb_set(
              coalesce(preferences, '{}'::jsonb),
              '{day_notes}',
              (preferences -> 'day_notes') - v_target_key,
              true
            )
          else coalesce(preferences, '{}'::jsonb)
        end,
        updated_at = now()
      where id = p_trip_id;

      if v_source_slot is not null then
        update trips
        set
          assignments = jsonb_set(
            coalesce(assignments, '{}'::jsonb),
            array[v_target_key],
            v_source_slot,
            true
          ),
          updated_at = now()
        where id = p_trip_id;
      end if;

      if v_source_note is not null and length(trim(v_source_note)) > 0 then
        update trips
        set preferences = jsonb_set(
          coalesce(preferences, '{}'::jsonb),
          array['day_notes', v_target_key],
          to_jsonb(v_source_note),
          true
        ),
        updated_at = now()
        where id = p_trip_id;
      end if;
    else
      select coalesce(assignments -> v_target_key, '{}'::jsonb) into v_cur
      from trips where id = p_trip_id;

      if v_source_slot is not null then
        foreach v_slot in ARRAY ARRAY['am', 'pm', 'lunch', 'dinner'] loop
          if v_source_slot ? v_slot then
            if not v_cur ? v_slot then
              v_cur := jsonb_set(v_cur, array[v_slot], v_source_slot -> v_slot, true);
            elsif jsonb_typeof(v_cur -> v_slot) = 'object' then
              if coalesce(v_cur -> v_slot ->> 'parkId', '') = '' then
                v_cur := jsonb_set(v_cur, array[v_slot], v_source_slot -> v_slot, true);
              end if;
            elsif coalesce(v_cur ->> v_slot, '') = '' then
              v_cur := jsonb_set(v_cur, array[v_slot], v_source_slot -> v_slot, true);
            end if;
          end if;
        end loop;

        update trips
        set
          assignments = jsonb_set(coalesce(assignments, '{}'::jsonb), array[v_target_key], v_cur, true),
          updated_at = now()
        where id = p_trip_id;
      end if;

      if v_source_note is not null and length(trim(v_source_note)) > 0 then
        update trips
        set preferences = jsonb_set(
          coalesce(preferences, '{}'::jsonb),
          array['day_notes', v_target_key],
          to_jsonb(v_source_note),
          true
        ),
        updated_at = now()
        where id = p_trip_id;
      end if;
    end if;

    select coalesce(max(sort_order), -1) + 1 into v_next_sort
    from trip_ride_priorities
    where trip_id = p_trip_id and day_date = v_target;

    for v_rec in
      select
        attraction_id,
        priority,
        notes,
        sort_order,
        skip_line_return_hhmm,
        pasted_queue_minutes
      from trip_ride_priorities
      where trip_id = p_trip_id and day_date = p_source
      order by priority, sort_order
    loop
      insert into trip_ride_priorities (
        trip_id,
        attraction_id,
        day_date,
        priority,
        sort_order,
        notes,
        skip_line_return_hhmm,
        pasted_queue_minutes
      ) values (
        p_trip_id,
        v_rec.attraction_id,
        v_target,
        v_rec.priority,
        v_next_sort,
        v_rec.notes,
        v_rec.skip_line_return_hhmm,
        v_rec.pasted_queue_minutes
      );
      v_next_sort := v_next_sort + 1;
    end loop;
  end loop;

  update trips set updated_at = now() where id = p_trip_id;
end;
$$;

grant execute on function public.duplicate_trip_day(uuid, date, date[], text) to authenticated;

create or replace function public.apply_day_template(
  p_template_id uuid,
  p_trip_id uuid,
  p_date date,
  p_merge text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_payload jsonb;
  v_day_key text := to_char(p_date, 'YYYY-MM-DD');
  v_assign jsonb;
  v_cur jsonb;
  v_slot text;
  v_next_sort int;
  el jsonb;
  v_pq text;
  v_pq_n int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select t.payload into v_payload
  from trip_day_templates t
  where t.id = p_template_id and t.user_id = v_uid;

  if v_payload is null then
    raise exception 'template not found';
  end if;

  if not exists (
    select 1 from trips tr
    where tr.id = p_trip_id
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
    raise exception 'trip not found';
  end if;

  v_assign := coalesce(v_payload -> 'assignments', '{}'::jsonb);

  if p_merge = 'replace' then
    delete from trip_ride_priorities
    where trip_id = p_trip_id and day_date = p_date;

    update trips
    set
      assignments = jsonb_set(
        coalesce(assignments, '{}'::jsonb) - v_day_key,
        array[v_day_key],
        v_assign,
        true
      ),
      preferences = case
        when preferences ? 'day_notes' then
          jsonb_set(
            coalesce(preferences, '{}'::jsonb),
            '{day_notes}',
            (preferences -> 'day_notes') - v_day_key,
            true
          )
        else coalesce(preferences, '{}'::jsonb)
      end,
      updated_at = now()
    where id = p_trip_id;

    if v_payload ? 'dayNote' and length(trim(v_payload ->> 'dayNote')) > 0 then
      update trips
      set preferences = jsonb_set(
        coalesce(preferences, '{}'::jsonb),
        array['day_notes', v_day_key],
        to_jsonb(v_payload ->> 'dayNote'),
        true
      ),
      updated_at = now()
      where id = p_trip_id;
    end if;
  else
    select coalesce(assignments -> v_day_key, '{}'::jsonb) into v_cur
    from trips where id = p_trip_id;

    foreach v_slot in ARRAY ARRAY['am', 'pm', 'lunch', 'dinner'] loop
      if v_assign ? v_slot then
        if not v_cur ? v_slot then
          v_cur := jsonb_set(v_cur, array[v_slot], v_assign -> v_slot, true);
        elsif jsonb_typeof(v_cur -> v_slot) = 'object' then
          if coalesce(v_cur -> v_slot ->> 'parkId', '') = '' then
            v_cur := jsonb_set(v_cur, array[v_slot], v_assign -> v_slot, true);
          end if;
        elsif coalesce(v_cur ->> v_slot, '') = '' then
          v_cur := jsonb_set(v_cur, array[v_slot], v_assign -> v_slot, true);
        end if;
      end if;
    end loop;

    update trips
    set
      assignments = jsonb_set(coalesce(assignments, '{}'::jsonb), array[v_day_key], v_cur, true),
      updated_at = now()
    where id = p_trip_id;

    if v_payload ? 'dayNote' and length(trim(v_payload ->> 'dayNote')) > 0 then
      update trips
      set preferences = jsonb_set(
        coalesce(preferences, '{}'::jsonb),
        array['day_notes', v_day_key],
        to_jsonb(v_payload ->> 'dayNote'),
        true
      ),
      updated_at = now()
      where id = p_trip_id;
    end if;
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_next_sort
  from trip_ride_priorities
  where trip_id = p_trip_id and day_date = p_date;

  for el in
    select * from jsonb_array_elements(coalesce(v_payload -> 'ridePriorities', '[]'::jsonb))
  loop
    if el ->> 'attractionId' is not null and length(trim(el ->> 'attractionId')) > 0 then
      v_pq_n := null;
      if el ? 'pastedQueueMinutes' and el -> 'pastedQueueMinutes' is not null then
        v_pq := el ->> 'pastedQueueMinutes';
        if v_pq is not null and v_pq ~ '^\d{1,3}$' then
          v_pq_n := least(600, greatest(0, v_pq::int));
        end if;
      end if;

      insert into trip_ride_priorities (
        trip_id,
        attraction_id,
        day_date,
        priority,
        sort_order,
        notes,
        skip_line_return_hhmm,
        pasted_queue_minutes
      ) values (
        p_trip_id,
        trim(el ->> 'attractionId'),
        p_date,
        case when trim(coalesce(el ->> 'priority', 'must_do')) = 'if_time' then 'if_time'::ride_priority else 'must_do'::ride_priority end,
        v_next_sort,
        nullif(trim(coalesce(el ->> 'notes', '')), ''),
        nullif(
          case
            when el ? 'skipLineReturnHhmm' and el ->> 'skipLineReturnHhmm' is not null
            then nullif(trim(el ->> 'skipLineReturnHhmm'), '')
            else null
          end,
          ''
        ),
        v_pq_n
      );
      v_next_sort := v_next_sort + 1;
    end if;
  end loop;

  update trips set updated_at = now() where id = p_trip_id;
end;
$$;

grant execute on function public.apply_day_template(uuid, uuid, date, text) to authenticated;
