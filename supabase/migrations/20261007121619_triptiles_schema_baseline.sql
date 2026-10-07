-- TripTiles canonical schema baseline.
-- Replaces the historical migration chain archived in supabase/legacy-migrations/.
-- Built from the replayed end state of that chain, then cleaned:
-- retired Payhip, user_subscriptions, tripp_usage, concierge_requests,
-- affiliate_conversions, park_checkins, unused views/functions, the duplicate
-- purchases unique index, and parks.region_ids_backup_pre_cleanup.
-- Collaborator read/update and editor trip updates are restored without the
-- historical RLS recursion.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS private;


--
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: concierge_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.concierge_status AS ENUM (
    'pending',
    'in_progress',
    'ready_for_review',
    'delivered',
    'refunded'
);


--
-- Name: destination; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.destination AS ENUM (
    'orlando',
    'paris',
    'tokyo',
    'cali',
    'cruise',
    'custom'
);


--
-- Name: invite_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invite_status AS ENUM (
    'pending',
    'accepted',
    'declined',
    'revoked'
);


--
-- Name: ride_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ride_priority AS ENUM (
    'must_do',
    'if_time'
);


--
-- Name: slot_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.slot_type AS ENUM (
    'am',
    'pm',
    'lunch',
    'dinner'
);


--
-- Name: trip_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.trip_status AS ENUM (
    'draft',
    'planning',
    'booked',
    'in_progress',
    'completed',
    'archived'
);


--
-- Name: user_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_tier AS ENUM (
    'free',
    'pro',
    'family',
    'concierge',
    'agent_staff',
    'agent_admin',
    'premium'
);


--
-- Name: is_accepted_collaborator(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_accepted_collaborator(p_trip_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1 from public.trip_collaborators
    where trip_id = p_trip_id
      and user_id = auth.uid()
      and status = 'accepted'
  );
$$;


--
-- Name: is_editor(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_editor(p_trip_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1 from public.trip_collaborators
    where trip_id = p_trip_id
      and user_id = auth.uid()
      and status = 'accepted'
      and role = 'editor'
  );
$$;


--
-- Name: is_trip_owner(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_trip_owner(p_trip_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select exists (
    select 1 from public.trips
    where id = p_trip_id
      and owner_id = auth.uid()
  );
$$;


--
-- Name: trips_guard_owner_change(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.trips_guard_owner_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if new.owner_id is distinct from old.owner_id
     and old.owner_id is distinct from auth.uid() then
    raise exception 'only the trip owner can change owner_id';
  end if;
  return new;
end;
$$;


--
-- Name: append_trip_behaviour_signal(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.append_trip_behaviour_signal(p_trip_id uuid, p_user_id uuid, p_signal jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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
$$;


--
-- Name: apply_day_template(uuid, uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_day_template(p_template_id uuid, p_trip_id uuid, p_date date, p_merge text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $_$
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
$_$;


--
-- Name: current_user_agency_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_agency_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select agency_id from profiles where id = auth.uid();
$$;


--
-- Name: current_user_tier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_tier() RETURNS public.user_tier
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select tier from profiles where id = auth.uid();
$$;


--
-- Name: duplicate_trip_day(uuid, date, date[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.duplicate_trip_day(p_trip_id uuid, p_source date, p_targets date[], p_merge text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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
$$;


--
-- Name: recalc_profile_trip_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalc_profile_trip_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  uid uuid;
begin
  uid := coalesce(new.owner_id, old.owner_id);
  
  update profiles
  set 
    trips_planned_count = (select count(*) from trips where owner_id = uid),
    days_planned_count = coalesce((
      select sum((end_date - start_date) + 1)::int 
      from trips 
      where owner_id = uid
    ), 0),
    last_active_at = now()
  where id = uid;
  
  return coalesce(new, old);
end;
$$;


--
-- Name: reorder_ride_priority(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reorder_ride_priority(p_id uuid, p_new_sort_order integer) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: save_day_plan_feedback(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_day_plan_feedback(p_trip_id uuid, p_user_id uuid, p_date text, p_feedback jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
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
$_$;


--
-- Name: save_trip_planning_profile(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_trip_planning_profile(p_trip_id uuid, p_user_id uuid, p_profile jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
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
$$;


--
-- Name: set_trip_day_planning_intent(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_trip_day_planning_intent(p_trip_id uuid, p_user_id uuid, p_date text, p_intent jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
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
$_$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: user_custom_tile_limit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_custom_tile_limit(uid uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select case
    when tier = 'free' then 5
    else 999999  -- effectively unlimited
  end
  from profiles
  where id = uid;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: achievement_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_definitions (
    key text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    icon text NOT NULL,
    category text NOT NULL,
    threshold integer,
    sort_order integer DEFAULT 100
);


--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    achievement_key text NOT NULL,
    earned_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: affiliate_clicks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliate_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    trip_id uuid,
    provider text NOT NULL,
    product_type text NOT NULL,
    target_url text NOT NULL,
    tile_id text,
    session_id text,
    referrer text,
    user_agent text,
    ip_country text,
    clicked_at timestamp with time zone DEFAULT now()
);


--
-- Name: agencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    logo_url text,
    primary_colour text DEFAULT '#0B1E5C'::text,
    accent_colour text DEFAULT '#C9A961'::text,
    contact_email text NOT NULL,
    contact_phone text,
    website text,
    subscription_status text DEFAULT 'trial'::text,
    subscription_plan text DEFAULT 'starter'::text,
    trial_ends_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    current_period_end timestamp with time zone,
    payhip_subscription_id text,
    max_seats integer DEFAULT 3,
    max_client_trips integer DEFAULT 50,
    booking_com_affiliate_id text,
    viator_affiliate_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_generations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trip_id uuid,
    prompt text NOT NULL,
    model text DEFAULT 'claude-haiku'::text NOT NULL,
    input_tokens integer,
    output_tokens integer,
    cost_gbp_pence integer,
    success boolean DEFAULT true,
    error text,
    created_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'success'::text NOT NULL,
    response_completion_status text,
    prompt_data_quality_summary jsonb,
    output_park_region_match boolean,
    response_assignments jsonb,
    CONSTRAINT ai_generations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: COLUMN ai_generations.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_generations.status IS 'Lifecycle state: pending (reserved pre-Claude-call), success (Claude succeeded), failed (Claude failed), cancelled (user aborted). The rate limit counts pending + success rows.';


--
-- Name: COLUMN ai_generations.response_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.ai_generations.response_assignments IS 'Post-guardrail parsed day assignments from Smart Plan (diagnostic).';


--
-- Name: attractions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attractions (
    id text NOT NULL,
    park_id text NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'ride'::text NOT NULL,
    height_requirement_cm integer,
    thrill_level text DEFAULT 'moderate'::text NOT NULL,
    is_indoor boolean DEFAULT false NOT NULL,
    duration_minutes integer,
    skip_line_system text,
    skip_line_tier text,
    skip_line_notes text,
    avg_wait_peak_minutes integer,
    avg_wait_offpeak_minutes integer,
    best_time_to_ride text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_seasonal boolean DEFAULT false NOT NULL,
    is_temporarily_closed boolean DEFAULT false NOT NULL,
    closure_note text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    official_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    verification_status text DEFAULT 'unverified'::text NOT NULL,
    verified_at date,
    verified_by text,
    source_url text,
    height_requirement_accompanied_cm integer,
    min_age_years integer,
    virtual_queue boolean,
    typical_closure_weeks text,
    CONSTRAINT attractions_category_check CHECK ((category = ANY (ARRAY['ride'::text, 'show'::text, 'character_meet'::text, 'experience'::text]))),
    CONSTRAINT attractions_thrill_check CHECK ((thrill_level = ANY (ARRAY['gentle'::text, 'moderate'::text, 'thrilling'::text, 'intense'::text]))),
    CONSTRAINT attractions_verification_status_check CHECK ((verification_status = ANY (ARRAY['verified'::text, 'partial'::text, 'unverified'::text, 'retired'::text]))),
    CONSTRAINT attractions_verified_by_check CHECK (((verified_by IS NULL) OR (verified_by = ANY (ARRAY['official_site'::text, 'manual_review'::text, 'community_crowdsource'::text])))),
    CONSTRAINT chk_attractions_skip_line_system CHECK (((skip_line_system IS NULL) OR (skip_line_system = ANY (ARRAY['lightning_lane'::text, 'premier_access'::text, 'express'::text, 'none'::text])))),
    CONSTRAINT chk_attractions_skip_line_tier CHECK (((skip_line_tier IS NULL) OR (skip_line_tier = ANY (ARRAY['single_pass'::text, 'multi_pass_tier1'::text, 'multi_pass_tier2'::text, 'multi_pass'::text, 'express'::text]))))
);


--
-- Name: COLUMN attractions.tags; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attractions.tags IS 'Operational tags. Allowed values: water_ride, dark_ride, coaster, spinning, motion_sickness_risk, loud, scary, character, nighttime_spectacular (enforce in import scripts; DB does not constrain array elements).';


--
-- Name: COLUMN attractions.verification_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attractions.verification_status IS 'verified=confirmed from official source, partial=some fields missing, unverified=not checked, retired=no longer operating';


--
-- Name: COLUMN attractions.verified_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attractions.verified_at IS 'Date of last verification pass';


--
-- Name: COLUMN attractions.verified_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attractions.verified_by IS 'Source type of verification: official_site | manual_review | community_crowdsource';


--
-- Name: COLUMN attractions.source_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attractions.source_url IS 'URL of the specific page data was sourced from — may differ from official_url (attraction page vs data source page)';


--
-- Name: COLUMN attractions.height_requirement_accompanied_cm; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attractions.height_requirement_accompanied_cm IS 'Minimum height in cm when accompanied by a responsible adult; null if not applicable';


--
-- Name: COLUMN attractions.min_age_years; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attractions.min_age_years IS 'Minimum age in years; null if no restriction';


--
-- Name: COLUMN attractions.virtual_queue; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attractions.virtual_queue IS 'TRUE if ride uses virtual boarding groups (e.g. Tron, Guardians). NULL = unknown.';


--
-- Name: COLUMN attractions.typical_closure_weeks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.attractions.typical_closure_weeks IS 'Typical annual refurb / closure window (free text), null if no known pattern';


--
-- Name: custom_tiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_tiles (
    id text NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    park_group text NOT NULL,
    bg_colour text DEFAULT '#0B1E5C'::text NOT NULL,
    fg_colour text DEFAULT '#C9A961'::text NOT NULL,
    region_ids text[] DEFAULT ARRAY[]::text[] NOT NULL,
    save_to_library boolean DEFAULT false NOT NULL,
    icon text,
    notes text,
    address text,
    url text,
    trips_used_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_tiles_bg_colour_hex CHECK ((bg_colour ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT custom_tiles_fg_colour_hex CHECK ((fg_colour ~ '^#[0-9A-Fa-f]{6}$'::text)),
    CONSTRAINT custom_tiles_name_length CHECK (((char_length(name) > 0) AND (char_length(name) <= 40))),
    CONSTRAINT custom_tiles_park_group_valid CHECK ((park_group = ANY (ARRAY['disney'::text, 'disneyextra'::text, 'universal'::text, 'seaworld'::text, 'attractions'::text, 'sights'::text, 'excursions'::text, 'dining'::text, 'activities'::text, 'travel'::text])))
);


--
-- Name: email_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trip_id uuid,
    template text NOT NULL,
    scheduled_for timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    status text DEFAULT 'queued'::text,
    error text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    anonymous_email text,
    category text NOT NULL,
    message text NOT NULL,
    page_url text,
    user_agent text,
    resolved boolean DEFAULT false,
    resolved_at timestamp with time zone,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT feedback_category_check CHECK ((category = ANY (ARRAY['bug'::text, 'feature'::text, 'question'::text, 'compliment'::text, 'other'::text]))),
    CONSTRAINT feedback_message_length CHECK (((char_length(message) >= 5) AND (char_length(message) <= 5000)))
);


--
-- Name: TABLE feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.feedback IS 'In-app user feedback. Read by admin via dashboard or admin page.';


--
-- Name: import_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    script_name text NOT NULL,
    file_path text,
    file_sha256 text,
    dry_run boolean DEFAULT true NOT NULL,
    applied_by text,
    git_sha text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    rows_ok integer DEFAULT 0 NOT NULL,
    rows_err integer DEFAULT 0 NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: TABLE import_batches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.import_batches IS 'Append-only log for CSV alignment imports; written by service-role scripts only.';


--
-- Name: live_wait_current; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_wait_current (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    park_id text,
    attraction_id text,
    external_park_id text DEFAULT ''::text NOT NULL,
    external_attraction_id text DEFAULT ''::text NOT NULL,
    external_name text,
    wait_minutes integer,
    operating_status text DEFAULT 'unknown'::text NOT NULL,
    is_open boolean DEFAULT false NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    stale_after timestamp with time zone NOT NULL,
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT live_wait_current_operating_status_check CHECK ((operating_status = ANY (ARRAY['open'::text, 'closed'::text, 'temporarily_closed'::text, 'refurb'::text, 'down'::text, 'unknown'::text]))),
    CONSTRAINT live_wait_current_provider_nonempty CHECK ((length(TRIM(BOTH FROM provider)) > 0)),
    CONSTRAINT live_wait_current_wait_minutes_check CHECK (((wait_minutes IS NULL) OR (wait_minutes >= 0)))
);


--
-- Name: TABLE live_wait_current; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.live_wait_current IS 'Latest normalised wait snapshot per provider external key; optimised for UI/API reads.';


--
-- Name: COLUMN live_wait_current.stale_after; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_current.stale_after IS 'Advisory freshness horizon (e.g. observed_at + policy TTL). Past stale_after ⇒ treat as stale in UI.';


--
-- Name: COLUMN live_wait_current.raw_payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_current.raw_payload IS 'Latest raw provider payload for diagnostics; trim in API if needed.';


--
-- Name: live_wait_park_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_wait_park_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    park_id text,
    provider text NOT NULL,
    external_park_id text NOT NULL,
    external_park_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT live_wait_park_mappings_ext_nonempty CHECK ((length(TRIM(BOTH FROM external_park_id)) > 0)),
    CONSTRAINT live_wait_park_mappings_provider_nonempty CHECK ((length(TRIM(BOTH FROM provider)) > 0))
);


--
-- Name: TABLE live_wait_park_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.live_wait_park_mappings IS 'Maps TripTiles parks.id to Queue-Times park ids for live wait ingestion and diagnostics.';


--
-- Name: COLUMN live_wait_park_mappings.external_park_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_park_mappings.external_park_id IS 'Queue-Times park id (numeric id from parks.json, stored as text).';


--
-- Name: live_wait_provider_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_wait_provider_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    external_park_id text DEFAULT ''::text NOT NULL,
    external_attraction_id text DEFAULT ''::text NOT NULL,
    park_id text,
    attraction_id text,
    external_name text,
    mapping_confidence numeric(4,3),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT live_wait_provider_mappings_mapping_confidence_check CHECK (((mapping_confidence IS NULL) OR ((mapping_confidence >= (0)::numeric) AND (mapping_confidence <= (1)::numeric)))),
    CONSTRAINT live_wait_provider_mappings_provider_nonempty CHECK ((length(TRIM(BOTH FROM provider)) > 0))
);


--
-- Name: TABLE live_wait_provider_mappings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.live_wait_provider_mappings IS 'Maps external provider park/ride identifiers to TripTiles park_id and attraction_id for live wait ingestion.';


--
-- Name: COLUMN live_wait_provider_mappings.provider; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_provider_mappings.provider IS 'Ingestion source id (e.g. thrill_data, queue_times) — adapter-owned string.';


--
-- Name: COLUMN live_wait_provider_mappings.external_park_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_provider_mappings.external_park_id IS 'Provider-native park identifier.';


--
-- Name: COLUMN live_wait_provider_mappings.external_attraction_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_provider_mappings.external_attraction_id IS 'Provider-native ride/attraction identifier.';


--
-- Name: COLUMN live_wait_provider_mappings.mapping_confidence; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_provider_mappings.mapping_confidence IS 'Optional 0–1 confidence for suggested or auto mappings.';


--
-- Name: live_wait_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_wait_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    park_id text,
    attraction_id text,
    external_park_id text DEFAULT ''::text NOT NULL,
    external_attraction_id text DEFAULT ''::text NOT NULL,
    external_name text,
    wait_minutes integer,
    operating_status text DEFAULT 'unknown'::text NOT NULL,
    is_open boolean DEFAULT false NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT live_wait_snapshots_operating_status_check CHECK ((operating_status = ANY (ARRAY['open'::text, 'closed'::text, 'temporarily_closed'::text, 'refurb'::text, 'down'::text, 'unknown'::text]))),
    CONSTRAINT live_wait_snapshots_provider_nonempty CHECK ((length(TRIM(BOTH FROM provider)) > 0)),
    CONSTRAINT live_wait_snapshots_wait_minutes_check CHECK (((wait_minutes IS NULL) OR (wait_minutes >= 0)))
);


--
-- Name: TABLE live_wait_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.live_wait_snapshots IS 'Historical live wait fetches; raw_payload retained for debugging and provider drift.';


--
-- Name: COLUMN live_wait_snapshots.observed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_snapshots.observed_at IS 'Provider-reported observation time (wall clock as returned by adapter, UTC stored).';


--
-- Name: COLUMN live_wait_snapshots.fetched_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_snapshots.fetched_at IS 'When TripTiles stored this row.';


--
-- Name: COLUMN live_wait_snapshots.raw_payload; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.live_wait_snapshots.raw_payload IS 'Unnormalised provider document for the row.';


--
-- Name: park_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.park_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    park_id text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    source_url text NOT NULL,
    source_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT park_areas_name_nonempty CHECK ((length(TRIM(BOTH FROM name)) > 0))
);


--
-- Name: park_briefings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.park_briefings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    park_id text NOT NULL,
    locale text DEFAULT 'en'::text NOT NULL,
    body text NOT NULL,
    source_url text NOT NULL,
    source_date date NOT NULL,
    supersedes_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT park_briefings_body_nonempty CHECK ((length(TRIM(BOTH FROM body)) > 0))
);


--
-- Name: parks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parks (
    id text NOT NULL,
    name text NOT NULL,
    icon text,
    bg_colour text NOT NULL,
    fg_colour text NOT NULL,
    park_group text NOT NULL,
    destinations public.destination[] NOT NULL,
    country text,
    latitude numeric,
    longitude numeric,
    official_url text,
    affiliate_hotel_query text,
    affiliate_ticket_url text,
    is_custom boolean DEFAULT false,
    created_by uuid,
    agency_id uuid,
    sort_order integer DEFAULT 100,
    created_at timestamp with time zone DEFAULT now(),
    region_ids text[] DEFAULT ARRAY[]::text[] NOT NULL,
    opens_at text,
    closes_at text,
    hours_known boolean DEFAULT false NOT NULL,
    enrichment_status text DEFAULT 'unverified'::text,
    notes text,
    CONSTRAINT chk_parks_enrichment_status CHECK (((enrichment_status IS NULL) OR (enrichment_status = ANY (ARRAY['verified'::text, 'template'::text, 'no_fixed_hours'::text, 'seasonal'::text, 'unverified'::text])))),
    CONSTRAINT parks_closes_at_hhmm_check CHECK (((closes_at IS NULL) OR (closes_at ~ '^\d{2}:\d{2}$'::text))),
    CONSTRAINT parks_opens_at_hhmm_check CHECK (((opens_at IS NULL) OR (opens_at ~ '^\d{2}:\d{2}$'::text)))
);


--
-- Name: COLUMN parks.enrichment_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parks.enrichment_status IS 'Provenance tag: verified=real data confirmed from official source; template=itinerary placeholder with no real location; no_fixed_hours=real place but no fixed opening/closing time; seasonal=hours vary by season; unverified=not yet enriched.';


--
-- Name: COLUMN parks.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parks.notes IS 'Editorial notes from enrichment pass.';


--
-- Name: region_briefings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.region_briefings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    region_id text NOT NULL,
    locale text DEFAULT 'en'::text NOT NULL,
    body text NOT NULL,
    source_url text NOT NULL,
    source_date date NOT NULL,
    supersedes_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT region_briefings_body_nonempty CHECK ((length(TRIM(BOTH FROM body)) > 0))
);


--
-- Name: region_skip_line_systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.region_skip_line_systems (
    region_id text NOT NULL,
    skip_line_system_id text NOT NULL,
    CONSTRAINT chk_region_skip_line_system_id CHECK ((skip_line_system_id = ANY (ARRAY['lightning_lane'::text, 'premier_access'::text, 'express'::text, 'none'::text])))
);


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id text NOT NULL,
    name text NOT NULL,
    short_name text NOT NULL,
    country text NOT NULL,
    country_code text NOT NULL,
    continent text NOT NULL,
    flag_emoji text,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    has_disney boolean DEFAULT false NOT NULL,
    has_universal boolean DEFAULT false NOT NULL,
    data_quality_tier text DEFAULT 'light'::text NOT NULL,
    CONSTRAINT regions_data_quality_tier_check CHECK ((data_quality_tier = ANY (ARRAY['deep'::text, 'standard'::text, 'light'::text])))
);


--
-- Name: park_alignment_completeness; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.park_alignment_completeness WITH (security_invoker='true') AS
 WITH pr AS (
         SELECT p.id AS park_id,
            rid.rid AS region_id
           FROM (public.parks p
             CROSS JOIN LATERAL unnest(p.region_ids) rid(rid))
          WHERE (COALESCE(p.is_custom, false) = false)
        ), attr AS (
         SELECT a.park_id,
            (count(*))::integer AS attraction_count,
            (sum(
                CASE
                    WHEN ((a.skip_line_system IS NOT NULL) AND (length(TRIM(BOTH FROM a.skip_line_system)) > 0)) THEN 1
                    ELSE 0
                END))::integer AS attractions_with_skip_line
           FROM public.attractions a
          GROUP BY a.park_id
        ), area_c AS (
         SELECT park_areas.park_id,
            (count(*))::integer AS area_count
           FROM public.park_areas
          GROUP BY park_areas.park_id
        ), rb AS (
         SELECT region_briefings.region_id,
            (count(*))::integer AS region_briefing_count
           FROM public.region_briefings
          GROUP BY region_briefings.region_id
        ), pb AS (
         SELECT park_briefings.park_id,
            (count(*))::integer AS park_briefing_count
           FROM public.park_briefings
          GROUP BY park_briefings.park_id
        ), rsl AS (
         SELECT region_skip_line_systems.region_id,
            (count(*))::integer AS region_skip_line_rows
           FROM public.region_skip_line_systems
          GROUP BY region_skip_line_systems.region_id
        ), rsl_non_none AS (
         SELECT region_skip_line_systems.region_id,
            (count(*))::integer AS cnt
           FROM public.region_skip_line_systems
          WHERE (region_skip_line_systems.skip_line_system_id IS DISTINCT FROM 'none'::text)
          GROUP BY region_skip_line_systems.region_id
        ), core AS (
         SELECT pr.region_id,
            pr.park_id,
            r.name AS region_name,
            p.name AS park_name,
            r.data_quality_tier,
                CASE
                    WHEN ((p.country IS NOT NULL) AND (length(TRIM(BOTH FROM p.country)) > 0)) THEN true
                    ELSE false
                END AS has_park_country,
                CASE
                    WHEN ((p.latitude IS NOT NULL) AND (p.longitude IS NOT NULL)) THEN true
                    ELSE false
                END AS has_coordinates,
                CASE
                    WHEN ((p.official_url IS NOT NULL) AND (length(TRIM(BOTH FROM p.official_url)) > 0)) THEN true
                    ELSE false
                END AS has_official_url,
                CASE
                    WHEN (COALESCE(p.hours_known, false) AND (p.opens_at IS NOT NULL) AND (p.closes_at IS NOT NULL)) THEN true
                    ELSE false
                END AS has_opening_hours,
                CASE
                    WHEN (COALESCE(ac.area_count, 0) > 0) THEN true
                    ELSE false
                END AS has_park_areas,
                CASE
                    WHEN (COALESCE(at.attraction_count, 0) > 0) THEN true
                    ELSE false
                END AS has_attractions,
                CASE
                    WHEN (COALESCE(rnn.cnt, 0) = 0) THEN true
                    WHEN (COALESCE(at.attraction_count, 0) = 0) THEN false
                    WHEN (COALESCE(at.attractions_with_skip_line, 0) = COALESCE(at.attraction_count, 0)) THEN true
                    ELSE false
                END AS skip_line_catalogue_ok,
                CASE
                    WHEN (COALESCE(rb.region_briefing_count, 0) > 0) THEN true
                    ELSE false
                END AS has_region_briefing,
                CASE
                    WHEN (COALESCE(pb.park_briefing_count, 0) > 0) THEN true
                    ELSE false
                END AS has_park_briefing,
            COALESCE(at.attraction_count, 0) AS attraction_count
           FROM (((((((pr
             JOIN public.parks p ON ((p.id = pr.park_id)))
             JOIN public.regions r ON ((r.id = pr.region_id)))
             LEFT JOIN attr at ON ((at.park_id = p.id)))
             LEFT JOIN area_c ac ON ((ac.park_id = p.id)))
             LEFT JOIN rb ON ((rb.region_id = pr.region_id)))
             LEFT JOIN pb ON ((pb.park_id = p.id)))
             LEFT JOIN rsl_non_none rnn ON ((rnn.region_id = pr.region_id)))
        ), scored AS (
         SELECT c.region_id,
            c.park_id,
            c.region_name,
            c.park_name,
            c.data_quality_tier,
            c.has_park_country,
            c.has_coordinates,
            c.has_official_url,
            c.has_opening_hours,
            c.has_park_areas,
            c.has_attractions,
            c.skip_line_catalogue_ok,
            c.has_region_briefing,
            c.has_park_briefing,
            c.attraction_count,
            (((((((((
                CASE
                    WHEN c.has_park_country THEN 5
                    ELSE 0
                END +
                CASE
                    WHEN c.has_coordinates THEN 15
                    ELSE 0
                END) +
                CASE
                    WHEN c.has_official_url THEN 15
                    ELSE 0
                END) +
                CASE
                    WHEN c.has_opening_hours THEN 15
                    ELSE 0
                END) +
                CASE
                    WHEN c.has_park_areas THEN 10
                    ELSE 0
                END) +
                CASE
                    WHEN c.has_attractions THEN 20
                    ELSE 0
                END) +
                CASE
                    WHEN c.skip_line_catalogue_ok THEN 10
                    ELSE 0
                END) +
                CASE
                    WHEN c.has_region_briefing THEN 5
                    ELSE 0
                END) +
                CASE
                    WHEN c.has_park_briefing THEN 5
                    ELSE 0
                END))::numeric(6,2) AS completeness_score,
            ((c.attraction_count = 0) OR ((NOT c.has_official_url) AND (NOT c.has_opening_hours))) AS is_launch_blocker
           FROM core c
        )
 SELECT region_id,
    park_id,
    region_name,
    park_name,
    data_quality_tier,
    has_park_country,
    has_coordinates,
    has_official_url,
    has_opening_hours,
    has_park_areas,
    has_attractions,
    skip_line_catalogue_ok,
    has_region_briefing,
    has_park_briefing,
    attraction_count,
    completeness_score,
    is_launch_blocker,
        CASE
            WHEN is_launch_blocker THEN 'blocked'::text
            WHEN (completeness_score >= (95)::numeric) THEN 'complete'::text
            WHEN (completeness_score >= (80)::numeric) THEN 'launch_ready'::text
            WHEN (completeness_score >= (50)::numeric) THEN 'fallback_ready'::text
            ELSE 'blocked'::text
        END AS readiness,
        CASE
            WHEN is_launch_blocker THEN 'Launch blocker: add attractions and/or official URL or opening hours.'::text
            WHEN (completeness_score >= (95)::numeric) THEN 'Complete for current scoring weights.'::text
            WHEN (NOT has_coordinates) THEN 'Next: import park-metadata (coordinates).'::text
            WHEN (NOT has_official_url) THEN 'Next: import park-metadata (official_url).'::text
            WHEN (NOT has_opening_hours) THEN 'Next: import park-hours.'::text
            WHEN (NOT has_park_areas) THEN 'Next: import park-areas.'::text
            WHEN (NOT has_attractions) THEN 'Next: import attractions.'::text
            WHEN (NOT skip_line_catalogue_ok) THEN 'Next: import skip-line-mapping for attractions.'::text
            WHEN (NOT has_region_briefing) THEN 'Next: import region-briefings.'::text
            WHEN (NOT has_park_briefing) THEN 'Next: import park-briefings.'::text
            ELSE 'Next: raise score with remaining dimensions.'::text
        END AS next_action_hint
   FROM scored s;


--
-- Name: VIEW park_alignment_completeness; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.park_alignment_completeness IS 'Per (region_id, built-in park_id) alignment flags, 0–100 score, readiness, and hint.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    display_name text,
    tier public.user_tier DEFAULT 'free'::public.user_tier NOT NULL,
    agency_id uuid,
    marketing_opt_in boolean DEFAULT false,
    referral_code text DEFAULT lower(replace((gen_random_uuid())::text, '-'::text, ''::text)),
    referred_by uuid,
    currency text DEFAULT 'GBP'::text,
    locale text DEFAULT 'en-GB'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    signup_fingerprint text,
    signup_ip_country text,
    trips_planned_count integer DEFAULT 0 NOT NULL,
    days_planned_count integer DEFAULT 0 NOT NULL,
    parks_visited_count integer DEFAULT 0 NOT NULL,
    ai_generations_lifetime integer DEFAULT 0 NOT NULL,
    templates_cloned_count integer DEFAULT 0 NOT NULL,
    last_active_at timestamp with time zone DEFAULT now(),
    temperature_unit text DEFAULT 'c'::text NOT NULL,
    email_marketing_opt_out boolean DEFAULT false NOT NULL,
    stripe_customer_id text,
    tier_expires_at timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    stripe_subscription_id text,
    CONSTRAINT profiles_temperature_unit_check CHECK ((temperature_unit = ANY (ARRAY['c'::text, 'f'::text])))
);


--
-- Name: COLUMN profiles.signup_fingerprint; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.signup_fingerprint IS 'Soft fingerprint hash from signup. Used for measurement only, not enforcement. Can be null.';


--
-- Name: COLUMN profiles.signup_ip_country; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.signup_ip_country IS 'ISO country code from signup IP. Used for analytics and tax/region detection.';


--
-- Name: COLUMN profiles.preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.preferences IS 'User-scoped UI and planner metadata (e.g. ai_day_preview_default, ai_day_plan_mode_a_success_count).';


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    product text NOT NULL,
    amount_gbp_pence integer NOT NULL,
    currency text DEFAULT 'GBP'::text,
    provider text NOT NULL,
    provider_order_id text,
    provider_customer_id text,
    status text DEFAULT 'completed'::text NOT NULL,
    refunded_at timestamp with time zone,
    discount_code_used text,
    affiliate_code text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    subscription_status text,
    subscription_period_end timestamp with time zone,
    billing_interval text,
    stripe_price_id text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT purchases_product_check CHECK ((product = ANY (ARRAY['pro'::text, 'family'::text, 'concierge'::text])))
);


--
-- Name: TABLE purchases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.purchases IS 'Financial records retained per UK HMRC requirements (5+ years). On account deletion, user_id is set to NULL and PII is anonymised but the transaction record is preserved.';


--
-- Name: COLUMN purchases.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.purchases.user_id IS 'References profiles(id). ON DELETE SET NULL so that account deletion does not destroy the financial record. NULL means the original purchaser has deleted their account.';


--
-- Name: region_alignment_rollup; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.region_alignment_rollup WITH (security_invoker='true') AS
 SELECT region_id,
    max(region_name) AS region_name,
    max(data_quality_tier) AS data_quality_tier,
    (count(*))::integer AS park_rows,
    (sum(
        CASE
            WHEN (readiness = 'complete'::text) THEN 1
            ELSE 0
        END))::integer AS parks_complete,
    (sum(
        CASE
            WHEN (readiness = 'blocked'::text) THEN 1
            ELSE 0
        END))::integer AS parks_blocked,
    round(avg(completeness_score), 2) AS avg_completeness_score,
    (sum(
        CASE
            WHEN (NOT has_attractions) THEN 1
            ELSE 0
        END))::integer AS parks_missing_attractions,
    (sum(
        CASE
            WHEN (NOT has_official_url) THEN 1
            ELSE 0
        END))::integer AS parks_missing_url,
    (sum(
        CASE
            WHEN (NOT has_opening_hours) THEN 1
            ELSE 0
        END))::integer AS parks_missing_hours,
    (sum(
        CASE
            WHEN (NOT has_coordinates) THEN 1
            ELSE 0
        END))::integer AS parks_missing_coordinates,
    (sum(
        CASE
            WHEN (NOT has_park_areas) THEN 1
            ELSE 0
        END))::integer AS parks_missing_areas,
    max(((NOT has_region_briefing))::integer) AS region_without_briefing,
    (sum(
        CASE
            WHEN (NOT has_park_briefing) THEN 1
            ELSE 0
        END))::integer AS parks_missing_park_briefing
   FROM public.park_alignment_completeness c
  GROUP BY region_id;


--
-- Name: VIEW region_alignment_rollup; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.region_alignment_rollup IS 'Region-level rollups over park_alignment_completeness rows.';


--
-- Name: region_data_completeness; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.region_data_completeness WITH (security_invoker='true') AS
 SELECT r.id AS region_id,
    r.name,
    r.data_quality_tier,
    r.has_disney,
    r.has_universal,
    (count(DISTINCT p.id))::integer AS parks_count,
    (COALESCE(sum(
        CASE
            WHEN p.hours_known THEN 1
            ELSE 0
        END), (0)::bigint))::integer AS parks_with_hours,
    array_remove(array_agg(DISTINCT rsl.skip_line_system_id), NULL::text) AS skip_line_system_ids
   FROM ((public.regions r
     LEFT JOIN public.parks p ON ((r.id = ANY (p.region_ids))))
     LEFT JOIN public.region_skip_line_systems rsl ON ((r.id = rsl.region_id)))
  GROUP BY r.id, r.name, r.data_quality_tier, r.has_disney, r.has_universal;


--
-- Name: skip_line_systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skip_line_systems (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    parent_brand text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stripe_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_webhook_events (
    id text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE stripe_webhook_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.stripe_webhook_events IS 'Idempotency log for incoming Stripe webhook events, keyed by event.id. Service role only; no RLS policies required.';


--
-- Name: trip_budget_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_budget_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    category text NOT NULL,
    label text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'GBP'::text NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trip_budget_items_category_check CHECK ((category = ANY (ARRAY['flights'::text, 'accommodation'::text, 'tickets'::text, 'dining'::text, 'transport'::text, 'insurance'::text, 'cruise'::text, 'shopping'::text, 'other'::text])))
);


--
-- Name: trip_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    category text NOT NULL,
    label text NOT NULL,
    is_checked boolean DEFAULT false NOT NULL,
    is_custom boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trip_checklist_items_category_check CHECK ((category = ANY (ARRAY['packing_essentials'::text, 'packing_clothing'::text, 'packing_kids'::text, 'packing_tech'::text, 'before_you_go'::text, 'at_the_park'::text])))
);


--
-- Name: trip_collaborators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_collaborators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    user_id uuid,
    invited_email text NOT NULL,
    invited_by uuid NOT NULL,
    role text DEFAULT 'editor'::text NOT NULL,
    status public.invite_status DEFAULT 'pending'::public.invite_status NOT NULL,
    invite_token text,
    invite_sent_at timestamp with time zone DEFAULT now(),
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: trip_day_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_day_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    payload jsonb NOT NULL,
    is_seed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trip_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    label text NOT NULL,
    amount_pence integer NOT NULL,
    currency text DEFAULT 'GBP'::text NOT NULL,
    booking_date date,
    due_date date,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    paid_at timestamp with time zone,
    category text,
    CONSTRAINT trip_payments_amount_pence_check CHECK ((amount_pence >= 0)),
    CONSTRAINT trip_payments_category_check CHECK (((category IS NULL) OR (category = ANY (ARRAY['cruise'::text, 'villa'::text, 'hotel'::text, 'flights'::text, 'tickets'::text, 'insurance'::text, 'dining'::text, 'other'::text])))),
    CONSTRAINT trip_payments_currency_check CHECK ((currency = ANY (ARRAY['GBP'::text, 'USD'::text]))),
    CONSTRAINT trip_payments_label_check CHECK (((char_length(label) >= 1) AND (char_length(label) <= 120)))
);


--
-- Name: trip_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    days_before integer NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trip_ride_priorities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_ride_priorities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    attraction_id text NOT NULL,
    day_date date NOT NULL,
    priority public.ride_priority DEFAULT 'must_do'::public.ride_priority NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    skip_line_return_hhmm text,
    pasted_queue_minutes integer,
    CONSTRAINT trip_ride_priorities_pasted_queue_minutes_check CHECK (((pasted_queue_minutes IS NULL) OR ((pasted_queue_minutes >= 0) AND (pasted_queue_minutes <= 600)))),
    CONSTRAINT trip_ride_priorities_skip_line_return_hhmm_check CHECK (((skip_line_return_hhmm IS NULL) OR (skip_line_return_hhmm ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text)))
);


--
-- Name: trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    agency_id uuid,
    family_name text DEFAULT 'My Family'::text NOT NULL,
    adventure_name text DEFAULT 'A Magical Adventure'::text NOT NULL,
    destination public.destination DEFAULT 'orlando'::public.destination NOT NULL,
    status public.trip_status DEFAULT 'planning'::public.trip_status NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    has_cruise boolean DEFAULT false,
    cruise_embark date,
    cruise_disembark date,
    cruise_line text,
    ship_name text,
    adults integer DEFAULT 2,
    children integer DEFAULT 0,
    child_ages integer[] DEFAULT ARRAY[]::integer[],
    total_budget_gbp integer,
    preferences jsonb DEFAULT '{}'::jsonb,
    assignments jsonb DEFAULT '{}'::jsonb NOT NULL,
    custom_parks jsonb DEFAULT '{}'::jsonb,
    notes text,
    is_public boolean DEFAULT false,
    public_slug text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_opened_at timestamp with time zone DEFAULT now(),
    clone_count integer DEFAULT 0 NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    region_id text,
    previous_assignments_snapshot jsonb,
    previous_preferences_snapshot jsonb,
    previous_assignments_snapshot_at timestamp with time zone,
    planning_preferences jsonb,
    colour_theme text DEFAULT 'classic'::text NOT NULL,
    budget_target numeric(10,2),
    budget_currency text DEFAULT 'GBP'::text,
    email_reminders boolean DEFAULT true NOT NULL,
    gallery_owner_label text,
    is_archived boolean DEFAULT false NOT NULL,
    archived_reason text,
    day_snapshots jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT trips_colour_theme_check CHECK ((colour_theme = ANY (ARRAY['classic'::text, 'pastel'::text, 'sunset'::text, 'ocean'::text, 'garden'::text, 'berry'::text])))
);


--
-- Name: COLUMN trips.previous_assignments_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trips.previous_assignments_snapshot IS 'Snapshot of assignments BEFORE the last Smart Plan generation. Used for one-level undo. Cleared when the user makes any manual edit after a Smart Plan run.';


--
-- Name: COLUMN trips.previous_preferences_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trips.previous_preferences_snapshot IS 'Snapshot of preferences (crowd summary, day notes) BEFORE the last Smart Plan. Restored together with assignments on undo.';


--
-- Name: COLUMN trips.previous_assignments_snapshot_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trips.previous_assignments_snapshot_at IS 'Timestamp of when the snapshot was taken. Powers "Undo Smart Plan from N minutes ago" UI.';


--
-- Name: COLUMN trips.planning_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trips.planning_preferences IS 'Structured Smart Plan wizard answers: pace, must-do park ids, priority tags, notes, party snapshot.';


--
-- Name: COLUMN trips.colour_theme; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trips.colour_theme IS 'Planner UI palette preset key (classic, pastel, sunset, ocean, garden, berry).';


--
-- Name: COLUMN trips.email_reminders; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trips.email_reminders IS 'When true, lifecycle and milestone reminder emails may be sent for this trip.';


--
-- Name: COLUMN trips.gallery_owner_label; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trips.gallery_owner_label IS 'Display label for the trip owner shown in the public gallery (e.g. "The Smith Family"). Null while unpublished.';


--
-- Name: COLUMN trips.day_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trips.day_snapshots IS 'Last 3 day-scoped AI changes per trip. Each entry: {date, before: {assignments_for_day, preferences_subset}, after, model, created_at, source}.';


--
-- Name: achievement_definitions achievement_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_definitions
    ADD CONSTRAINT achievement_definitions_pkey PRIMARY KEY (key);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: achievements achievements_user_id_achievement_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_user_id_achievement_key_key UNIQUE (user_id, achievement_key);


--
-- Name: affiliate_clicks affiliate_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_pkey PRIMARY KEY (id);


--
-- Name: agencies agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_pkey PRIMARY KEY (id);


--
-- Name: agencies agencies_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_slug_key UNIQUE (slug);


--
-- Name: ai_generations ai_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_pkey PRIMARY KEY (id);


--
-- Name: attractions attractions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attractions
    ADD CONSTRAINT attractions_pkey PRIMARY KEY (id);


--
-- Name: custom_tiles custom_tiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_tiles
    ADD CONSTRAINT custom_tiles_pkey PRIMARY KEY (id);


--
-- Name: email_queue email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: import_batches import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_batches
    ADD CONSTRAINT import_batches_pkey PRIMARY KEY (id);


--
-- Name: live_wait_current live_wait_current_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_current
    ADD CONSTRAINT live_wait_current_pkey PRIMARY KEY (id);


--
-- Name: live_wait_current live_wait_current_provider_ext_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_current
    ADD CONSTRAINT live_wait_current_provider_ext_unique UNIQUE (provider, external_park_id, external_attraction_id);


--
-- Name: live_wait_park_mappings live_wait_park_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_park_mappings
    ADD CONSTRAINT live_wait_park_mappings_pkey PRIMARY KEY (id);


--
-- Name: live_wait_park_mappings live_wait_park_mappings_provider_ext_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_park_mappings
    ADD CONSTRAINT live_wait_park_mappings_provider_ext_unique UNIQUE (provider, external_park_id);


--
-- Name: live_wait_provider_mappings live_wait_provider_mappings_ext_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_provider_mappings
    ADD CONSTRAINT live_wait_provider_mappings_ext_unique UNIQUE (provider, external_park_id, external_attraction_id);


--
-- Name: live_wait_provider_mappings live_wait_provider_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_provider_mappings
    ADD CONSTRAINT live_wait_provider_mappings_pkey PRIMARY KEY (id);


--
-- Name: live_wait_snapshots live_wait_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_snapshots
    ADD CONSTRAINT live_wait_snapshots_pkey PRIMARY KEY (id);


--
-- Name: park_areas park_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.park_areas
    ADD CONSTRAINT park_areas_pkey PRIMARY KEY (id);


--
-- Name: park_briefings park_briefings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.park_briefings
    ADD CONSTRAINT park_briefings_pkey PRIMARY KEY (id);


--
-- Name: parks parks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parks
    ADD CONSTRAINT parks_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: region_briefings region_briefings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_briefings
    ADD CONSTRAINT region_briefings_pkey PRIMARY KEY (id);


--
-- Name: region_skip_line_systems region_skip_line_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_skip_line_systems
    ADD CONSTRAINT region_skip_line_systems_pkey PRIMARY KEY (region_id, skip_line_system_id);


--
-- Name: regions regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT regions_pkey PRIMARY KEY (id);


--
-- Name: skip_line_systems skip_line_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skip_line_systems
    ADD CONSTRAINT skip_line_systems_pkey PRIMARY KEY (id);


--
-- Name: stripe_webhook_events stripe_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: trip_budget_items trip_budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_budget_items
    ADD CONSTRAINT trip_budget_items_pkey PRIMARY KEY (id);


--
-- Name: trip_checklist_items trip_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_checklist_items
    ADD CONSTRAINT trip_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: trip_collaborators trip_collaborators_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_collaborators
    ADD CONSTRAINT trip_collaborators_invite_token_key UNIQUE (invite_token);


--
-- Name: trip_collaborators trip_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_collaborators
    ADD CONSTRAINT trip_collaborators_pkey PRIMARY KEY (id);


--
-- Name: trip_day_templates trip_day_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_day_templates
    ADD CONSTRAINT trip_day_templates_pkey PRIMARY KEY (id);


--
-- Name: trip_payments trip_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_payments
    ADD CONSTRAINT trip_payments_pkey PRIMARY KEY (id);


--
-- Name: trip_reminders trip_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_reminders
    ADD CONSTRAINT trip_reminders_pkey PRIMARY KEY (id);


--
-- Name: trip_reminders trip_reminders_trip_id_days_before_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_reminders
    ADD CONSTRAINT trip_reminders_trip_id_days_before_key UNIQUE (trip_id, days_before);


--
-- Name: trip_ride_priorities trip_ride_priorities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ride_priorities
    ADD CONSTRAINT trip_ride_priorities_pkey PRIMARY KEY (id);


--
-- Name: trip_ride_priorities trip_ride_priorities_trip_id_attraction_id_day_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ride_priorities
    ADD CONSTRAINT trip_ride_priorities_trip_id_attraction_id_day_date_key UNIQUE (trip_id, attraction_id, day_date);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: trips trips_public_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_public_slug_key UNIQUE (public_slug);


--
-- Name: ai_generations_trip_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_generations_trip_status_idx ON public.ai_generations USING btree (trip_id, status) WHERE (status = ANY (ARRAY['pending'::text, 'success'::text]));


--
-- Name: feedback_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_category_idx ON public.feedback USING btree (category);


--
-- Name: feedback_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_created_at_idx ON public.feedback USING btree (created_at DESC);


--
-- Name: feedback_resolved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feedback_resolved_idx ON public.feedback USING btree (resolved) WHERE (resolved = false);


--
-- Name: idx_achievements_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_achievements_user ON public.achievements USING btree (user_id);


--
-- Name: idx_aff_clicks_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aff_clicks_date ON public.affiliate_clicks USING btree (clicked_at);


--
-- Name: idx_aff_clicks_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aff_clicks_provider ON public.affiliate_clicks USING btree (provider);


--
-- Name: idx_aff_clicks_trip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aff_clicks_trip ON public.affiliate_clicks USING btree (trip_id) WHERE (trip_id IS NOT NULL);


--
-- Name: idx_aff_clicks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_aff_clicks_user ON public.affiliate_clicks USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_agencies_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agencies_slug ON public.agencies USING btree (slug);


--
-- Name: idx_agencies_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agencies_status ON public.agencies USING btree (subscription_status);


--
-- Name: idx_ai_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_user_date ON public.ai_generations USING btree (user_id, created_at);


--
-- Name: idx_attractions_park_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attractions_park_id ON public.attractions USING btree (park_id);


--
-- Name: idx_collab_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_token ON public.trip_collaborators USING btree (invite_token) WHERE (invite_token IS NOT NULL);


--
-- Name: idx_collab_trip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_trip ON public.trip_collaborators USING btree (trip_id);


--
-- Name: idx_collab_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_collab_unique ON public.trip_collaborators USING btree (trip_id, invited_email);


--
-- Name: idx_collab_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_collab_user ON public.trip_collaborators USING btree (user_id);


--
-- Name: idx_custom_tiles_library; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_tiles_library ON public.custom_tiles USING btree (user_id) WHERE (save_to_library = true);


--
-- Name: idx_custom_tiles_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_tiles_region ON public.custom_tiles USING gin (region_ids);


--
-- Name: idx_custom_tiles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_tiles_user ON public.custom_tiles USING btree (user_id);


--
-- Name: idx_email_queue_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_scheduled ON public.email_queue USING btree (scheduled_for) WHERE (status = 'queued'::text);


--
-- Name: idx_email_queue_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_queue_user ON public.email_queue USING btree (user_id);


--
-- Name: idx_import_batches_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_batches_started ON public.import_batches USING btree (started_at DESC);


--
-- Name: idx_live_wait_current_attraction_observed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_current_attraction_observed ON public.live_wait_current USING btree (attraction_id, observed_at DESC);


--
-- Name: idx_live_wait_current_park_observed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_current_park_observed ON public.live_wait_current USING btree (park_id, observed_at DESC);


--
-- Name: idx_live_wait_current_provider_fetched; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_current_provider_fetched ON public.live_wait_current USING btree (provider, fetched_at DESC);


--
-- Name: idx_live_wait_current_stale_after; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_current_stale_after ON public.live_wait_current USING btree (stale_after);


--
-- Name: idx_live_wait_park_mappings_park; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_park_mappings_park ON public.live_wait_park_mappings USING btree (park_id) WHERE (park_id IS NOT NULL);


--
-- Name: idx_live_wait_provider_mappings_attraction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_provider_mappings_attraction_id ON public.live_wait_provider_mappings USING btree (attraction_id) WHERE (attraction_id IS NOT NULL);


--
-- Name: idx_live_wait_provider_mappings_provider_ext_attraction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_provider_mappings_provider_ext_attraction ON public.live_wait_provider_mappings USING btree (provider, external_attraction_id);


--
-- Name: idx_live_wait_snapshots_attraction_observed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_snapshots_attraction_observed ON public.live_wait_snapshots USING btree (attraction_id, observed_at DESC);


--
-- Name: idx_live_wait_snapshots_fetched; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_snapshots_fetched ON public.live_wait_snapshots USING btree (fetched_at DESC);


--
-- Name: idx_live_wait_snapshots_park_observed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_snapshots_park_observed ON public.live_wait_snapshots USING btree (park_id, observed_at DESC);


--
-- Name: idx_live_wait_snapshots_provider_ext_attraction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_wait_snapshots_provider_ext_attraction ON public.live_wait_snapshots USING btree (provider, external_attraction_id);


--
-- Name: idx_park_areas_park_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_park_areas_park_id ON public.park_areas USING btree (park_id);


--
-- Name: idx_park_areas_park_name_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_park_areas_park_name_lower ON public.park_areas USING btree (park_id, lower(TRIM(BOTH FROM name)));


--
-- Name: idx_park_briefings_park; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_park_briefings_park ON public.park_briefings USING btree (park_id, created_at DESC);


--
-- Name: idx_parks_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parks_agency ON public.parks USING btree (agency_id) WHERE (agency_id IS NOT NULL);


--
-- Name: idx_parks_destinations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parks_destinations ON public.parks USING gin (destinations);


--
-- Name: idx_parks_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parks_group ON public.parks USING btree (park_group);


--
-- Name: idx_parks_region_ids; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parks_region_ids ON public.parks USING gin (region_ids);


--
-- Name: idx_profiles_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_agency ON public.profiles USING btree (agency_id) WHERE (agency_id IS NOT NULL);


--
-- Name: idx_profiles_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_fingerprint ON public.profiles USING btree (signup_fingerprint) WHERE (signup_fingerprint IS NOT NULL);


--
-- Name: idx_profiles_referral; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_referral ON public.profiles USING btree (referral_code) WHERE (referral_code IS NOT NULL);


--
-- Name: idx_profiles_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_tier ON public.profiles USING btree (tier);


--
-- Name: idx_purchases_affiliate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_affiliate ON public.purchases USING btree (affiliate_code) WHERE (affiliate_code IS NOT NULL);


--
-- Name: idx_purchases_provider_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_purchases_provider_order ON public.purchases USING btree (provider, provider_order_id) WHERE (provider_order_id IS NOT NULL);


--
-- Name: idx_purchases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_status ON public.purchases USING btree (status);


--
-- Name: idx_purchases_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_user ON public.purchases USING btree (user_id);


--
-- Name: idx_region_briefings_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_region_briefings_region ON public.region_briefings USING btree (region_id, created_at DESC);


--
-- Name: idx_regions_continent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regions_continent ON public.regions USING btree (continent);


--
-- Name: idx_regions_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regions_country ON public.regions USING btree (country_code);


--
-- Name: idx_regions_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_regions_featured ON public.regions USING btree (is_featured) WHERE (is_featured = true);


--
-- Name: idx_trip_payments_trip_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trip_payments_trip_id ON public.trip_payments USING btree (trip_id);


--
-- Name: idx_trip_ride_priorities_trip_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trip_ride_priorities_trip_day ON public.trip_ride_priorities USING btree (trip_id, day_date);


--
-- Name: idx_trips_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_agency ON public.trips USING btree (agency_id) WHERE (agency_id IS NOT NULL);


--
-- Name: idx_trips_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_dates ON public.trips USING btree (start_date, end_date);


--
-- Name: idx_trips_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_owner ON public.trips USING btree (owner_id);


--
-- Name: idx_trips_owner_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_owner_active ON public.trips USING btree (owner_id) WHERE (is_archived = false);


--
-- Name: idx_trips_public; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_public ON public.trips USING btree (is_public) WHERE (is_public = true);


--
-- Name: idx_trips_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_region ON public.trips USING btree (region_id);


--
-- Name: idx_trips_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trips_slug ON public.trips USING btree (public_slug) WHERE (public_slug IS NOT NULL);


--
-- Name: trip_budget_items_trip_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trip_budget_items_trip_id_idx ON public.trip_budget_items USING btree (trip_id);


--
-- Name: trip_checklist_items_trip_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trip_checklist_items_trip_id_idx ON public.trip_checklist_items USING btree (trip_id);


--
-- Name: trip_day_templates_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trip_day_templates_user_id_idx ON public.trip_day_templates USING btree (user_id);


--
-- Name: trip_day_templates_user_seed_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trip_day_templates_user_seed_name_unique ON public.trip_day_templates USING btree (user_id, name) WHERE (is_seed = true);


--
-- Name: trip_reminders_sent_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trip_reminders_sent_at_idx ON public.trip_reminders USING btree (sent_at);


--
-- Name: trip_reminders_trip_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trip_reminders_trip_id_idx ON public.trip_reminders USING btree (trip_id);


--
-- Name: trips_public_slug_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX trips_public_slug_unique ON public.trips USING btree (public_slug) WHERE (public_slug IS NOT NULL);


--
-- Name: agencies agencies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agencies_updated_at BEFORE UPDATE ON public.agencies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: attractions attractions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER attractions_updated_at BEFORE UPDATE ON public.attractions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: live_wait_park_mappings live_wait_park_mappings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER live_wait_park_mappings_updated_at BEFORE UPDATE ON public.live_wait_park_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: live_wait_provider_mappings live_wait_provider_mappings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER live_wait_provider_mappings_updated_at BEFORE UPDATE ON public.live_wait_provider_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: trip_day_templates trip_day_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trip_day_templates_updated_at BEFORE UPDATE ON public.trip_day_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: trip_payments trip_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trip_payments_updated_at BEFORE UPDATE ON public.trip_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: trips trips_guard_owner_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trips_guard_owner_change BEFORE UPDATE OF owner_id ON public.trips FOR EACH ROW EXECUTE FUNCTION private.trips_guard_owner_change();


--
-- Name: trips trips_update_profile_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trips_update_profile_stats AFTER INSERT OR DELETE OR UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.recalc_profile_trip_stats();


--
-- Name: trips trips_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: achievements achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: affiliate_clicks affiliate_clicks_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;


--
-- Name: affiliate_clicks affiliate_clicks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliate_clicks
    ADD CONSTRAINT affiliate_clicks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: ai_generations ai_generations_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: ai_generations ai_generations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: attractions attractions_park_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attractions
    ADD CONSTRAINT attractions_park_id_fkey FOREIGN KEY (park_id) REFERENCES public.parks(id);


--
-- Name: custom_tiles custom_tiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_tiles
    ADD CONSTRAINT custom_tiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: email_queue email_queue_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: email_queue email_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: live_wait_current live_wait_current_attraction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_current
    ADD CONSTRAINT live_wait_current_attraction_id_fkey FOREIGN KEY (attraction_id) REFERENCES public.attractions(id) ON DELETE SET NULL;


--
-- Name: live_wait_current live_wait_current_park_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_current
    ADD CONSTRAINT live_wait_current_park_id_fkey FOREIGN KEY (park_id) REFERENCES public.parks(id) ON DELETE SET NULL;


--
-- Name: live_wait_park_mappings live_wait_park_mappings_park_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_park_mappings
    ADD CONSTRAINT live_wait_park_mappings_park_id_fkey FOREIGN KEY (park_id) REFERENCES public.parks(id) ON DELETE SET NULL;


--
-- Name: live_wait_provider_mappings live_wait_provider_mappings_attraction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_provider_mappings
    ADD CONSTRAINT live_wait_provider_mappings_attraction_id_fkey FOREIGN KEY (attraction_id) REFERENCES public.attractions(id) ON DELETE SET NULL;


--
-- Name: live_wait_provider_mappings live_wait_provider_mappings_park_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_provider_mappings
    ADD CONSTRAINT live_wait_provider_mappings_park_id_fkey FOREIGN KEY (park_id) REFERENCES public.parks(id) ON DELETE SET NULL;


--
-- Name: live_wait_snapshots live_wait_snapshots_attraction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_snapshots
    ADD CONSTRAINT live_wait_snapshots_attraction_id_fkey FOREIGN KEY (attraction_id) REFERENCES public.attractions(id) ON DELETE SET NULL;


--
-- Name: live_wait_snapshots live_wait_snapshots_park_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_wait_snapshots
    ADD CONSTRAINT live_wait_snapshots_park_id_fkey FOREIGN KEY (park_id) REFERENCES public.parks(id) ON DELETE SET NULL;


--
-- Name: park_areas park_areas_park_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.park_areas
    ADD CONSTRAINT park_areas_park_id_fkey FOREIGN KEY (park_id) REFERENCES public.parks(id) ON DELETE CASCADE;


--
-- Name: park_briefings park_briefings_park_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.park_briefings
    ADD CONSTRAINT park_briefings_park_id_fkey FOREIGN KEY (park_id) REFERENCES public.parks(id) ON DELETE CASCADE;


--
-- Name: park_briefings park_briefings_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.park_briefings
    ADD CONSTRAINT park_briefings_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.park_briefings(id) ON DELETE SET NULL;


--
-- Name: parks parks_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parks
    ADD CONSTRAINT parks_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;


--
-- Name: parks parks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parks
    ADD CONSTRAINT parks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_agency_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_agency_fk FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.profiles(id);


--
-- Name: purchases purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: region_briefings region_briefings_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_briefings
    ADD CONSTRAINT region_briefings_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE CASCADE;


--
-- Name: region_briefings region_briefings_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_briefings
    ADD CONSTRAINT region_briefings_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.region_briefings(id) ON DELETE SET NULL;


--
-- Name: region_skip_line_systems region_skip_line_systems_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_skip_line_systems
    ADD CONSTRAINT region_skip_line_systems_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id) ON DELETE CASCADE;


--
-- Name: region_skip_line_systems region_skip_line_systems_skip_line_system_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.region_skip_line_systems
    ADD CONSTRAINT region_skip_line_systems_skip_line_system_id_fkey FOREIGN KEY (skip_line_system_id) REFERENCES public.skip_line_systems(id) ON DELETE RESTRICT;


--
-- Name: trip_budget_items trip_budget_items_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_budget_items
    ADD CONSTRAINT trip_budget_items_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_checklist_items trip_checklist_items_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_checklist_items
    ADD CONSTRAINT trip_checklist_items_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_collaborators trip_collaborators_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_collaborators
    ADD CONSTRAINT trip_collaborators_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id);


--
-- Name: trip_collaborators trip_collaborators_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_collaborators
    ADD CONSTRAINT trip_collaborators_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_collaborators trip_collaborators_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_collaborators
    ADD CONSTRAINT trip_collaborators_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: trip_day_templates trip_day_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_day_templates
    ADD CONSTRAINT trip_day_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: trip_payments trip_payments_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_payments
    ADD CONSTRAINT trip_payments_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_reminders trip_reminders_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_reminders
    ADD CONSTRAINT trip_reminders_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_ride_priorities trip_ride_priorities_attraction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ride_priorities
    ADD CONSTRAINT trip_ride_priorities_attraction_id_fkey FOREIGN KEY (attraction_id) REFERENCES public.attractions(id) ON DELETE CASCADE;


--
-- Name: trip_ride_priorities trip_ride_priorities_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_ride_priorities
    ADD CONSTRAINT trip_ride_priorities_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trips trips_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;


--
-- Name: trips trips_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: trips trips_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.regions(id);


--
-- Name: ai_generations AI generations insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI generations insert own" ON public.ai_generations FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: ai_generations AI generations select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI generations select own" ON public.ai_generations FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: ai_generations AI generations update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "AI generations update own" ON public.ai_generations FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: affiliate_clicks Affiliate clicks select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Affiliate clicks select own" ON public.affiliate_clicks FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: agencies Agencies select for members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agencies select for members" ON public.agencies FOR SELECT USING ((id = public.current_user_agency_id()));


--
-- Name: agencies Agencies update for admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Agencies update for admins" ON public.agencies FOR UPDATE USING (((id = public.current_user_agency_id()) AND (public.current_user_tier() = 'agent_admin'::public.user_tier)));


--
-- Name: achievement_definitions Anyone can read achievement definitions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read achievement definitions" ON public.achievement_definitions FOR SELECT USING (true);


--
-- Name: attractions Anyone can read attractions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read attractions" ON public.attractions FOR SELECT USING (true);


--
-- Name: live_wait_current Anyone can read live_wait_current; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read live_wait_current" ON public.live_wait_current FOR SELECT TO authenticated, anon USING (true);


--
-- Name: park_areas Anyone can read park_areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read park_areas" ON public.park_areas FOR SELECT TO authenticated, anon USING (true);


--
-- Name: park_briefings Anyone can read park_briefings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read park_briefings" ON public.park_briefings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: region_briefings Anyone can read region_briefings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read region_briefings" ON public.region_briefings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: regions Anyone can read regions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read regions" ON public.regions FOR SELECT USING (true);


--
-- Name: trip_collaborators Collaborators delete by trip owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Collaborators delete by trip owner" ON public.trip_collaborators FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = trip_collaborators.trip_id) AND (trips.owner_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: trip_collaborators Collaborators insert by trip owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Collaborators insert by trip owner" ON public.trip_collaborators FOR INSERT WITH CHECK (((invited_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = trip_collaborators.trip_id) AND (trips.owner_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: trip_collaborators Collaborators select participant or owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Collaborators select participant or owner" ON public.trip_collaborators FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR (invited_by = ( SELECT auth.uid() AS uid)) OR private.is_trip_owner(trip_id) OR ((status = 'pending'::public.invite_status) AND (lower(invited_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text))))));


--
-- Name: trip_collaborators Collaborators update invitee or owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Collaborators update invitee or owner" ON public.trip_collaborators FOR UPDATE USING (((user_id = ( SELECT auth.uid() AS uid)) OR private.is_trip_owner(trip_id) OR ((status = 'pending'::public.invite_status) AND (lower(invited_email) = lower(COALESCE((auth.jwt() ->> 'email'::text), ''::text)))))) WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR private.is_trip_owner(trip_id)));


--
-- Name: email_queue Email queue insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Email queue insert own" ON public.email_queue FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: email_queue Email queue select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Email queue select own" ON public.email_queue FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: feedback Feedback insert own or anonymous; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Feedback insert own or anonymous" ON public.feedback FOR INSERT WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) OR ((user_id IS NULL) AND (anonymous_email IS NOT NULL))));


--
-- Name: feedback Feedback select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Feedback select own" ON public.feedback FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: parks Parks insert custom; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Parks insert custom" ON public.parks FOR INSERT WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (is_custom = true)));


--
-- Name: parks Parks select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Parks select" ON public.parks FOR SELECT USING ((((is_custom = false) AND (agency_id IS NULL)) OR (created_by = ( SELECT auth.uid() AS uid)) OR ((agency_id IS NOT NULL) AND (agency_id = public.current_user_agency_id()))));


--
-- Name: profiles Profiles select agency members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles select agency members" ON public.profiles FOR SELECT USING (((agency_id IS NOT NULL) AND (agency_id = public.current_user_agency_id()) AND (public.current_user_tier() = 'agent_admin'::public.user_tier)));


--
-- Name: profiles Profiles select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles select own" ON public.profiles FOR SELECT USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: profiles Profiles update own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: trip_ride_priorities Public trips ride priorities are readable; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public trips ride priorities are readable" ON public.trip_ride_priorities FOR SELECT USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.is_public = true))));


--
-- Name: purchases Purchases insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Purchases insert own" ON public.purchases FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: purchases Purchases select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Purchases select own" ON public.purchases FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: trip_ride_priorities Trip owner can manage ride priorities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trip owner can manage ride priorities" ON public.trip_ride_priorities USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_reminders Trip reminders delete own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trip reminders delete own" ON public.trip_reminders FOR DELETE USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_reminders Trip reminders insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trip reminders insert own" ON public.trip_reminders FOR INSERT WITH CHECK ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_reminders Trip reminders select own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trip reminders select own" ON public.trip_reminders FOR SELECT USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trips Trips delete own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trips delete own" ON public.trips FOR DELETE USING ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: trips Trips insert own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trips insert own" ON public.trips FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = owner_id));


--
-- Name: trips Trips select own, collaborator, or public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trips select own, collaborator, or public" ON public.trips FOR SELECT USING (((is_public = true) OR (owner_id = ( SELECT auth.uid() AS uid)) OR private.is_accepted_collaborator(id)));


--
-- Name: trips Trips update owner or editor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Trips update owner or editor" ON public.trips FOR UPDATE USING (((owner_id = ( SELECT auth.uid() AS uid)) OR private.is_editor(id))) WITH CHECK (((owner_id = ( SELECT auth.uid() AS uid)) OR private.is_editor(id)));


--
-- Name: custom_tiles Users can delete their own custom tiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own custom tiles" ON public.custom_tiles FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: achievements Users can insert their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own achievements" ON public.achievements FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: custom_tiles Users can insert their own custom tiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own custom tiles" ON public.custom_tiles FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: custom_tiles Users can update their own custom tiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own custom tiles" ON public.custom_tiles FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: achievements Users can view their own achievements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own achievements" ON public.achievements FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: custom_tiles Users can view their own custom tiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own custom tiles" ON public.custom_tiles FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: achievement_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: achievements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

--
-- Name: affiliate_clicks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

--
-- Name: agencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

--
-- Name: attractions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attractions ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_tiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_tiles ENABLE ROW LEVEL SECURITY;

--
-- Name: email_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: import_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: live_wait_current; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_wait_current ENABLE ROW LEVEL SECURITY;

--
-- Name: live_wait_park_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_wait_park_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: live_wait_provider_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_wait_provider_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: live_wait_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_wait_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: park_areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.park_areas ENABLE ROW LEVEL SECURITY;

--
-- Name: park_briefings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.park_briefings ENABLE ROW LEVEL SECURITY;

--
-- Name: parks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parks ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: region_skip_line_systems read region skip line systems; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read region skip line systems" ON public.region_skip_line_systems FOR SELECT TO authenticated USING (true);


--
-- Name: skip_line_systems read skip line systems; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read skip line systems" ON public.skip_line_systems FOR SELECT TO authenticated USING (true);


--
-- Name: region_briefings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.region_briefings ENABLE ROW LEVEL SECURITY;

--
-- Name: region_skip_line_systems; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.region_skip_line_systems ENABLE ROW LEVEL SECURITY;

--
-- Name: regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

--
-- Name: skip_line_systems; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.skip_line_systems ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_budget_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_budget_items ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_budget_items trip_budget_items_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_budget_items_delete_own ON public.trip_budget_items FOR DELETE USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_budget_items trip_budget_items_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_budget_items_insert_own ON public.trip_budget_items FOR INSERT WITH CHECK ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_budget_items trip_budget_items_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_budget_items_select_own ON public.trip_budget_items FOR SELECT USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_budget_items trip_budget_items_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_budget_items_update_own ON public.trip_budget_items FOR UPDATE USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_checklist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_checklist_items trip_checklist_items_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_checklist_items_delete_own ON public.trip_checklist_items FOR DELETE USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_checklist_items trip_checklist_items_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_checklist_items_insert_own ON public.trip_checklist_items FOR INSERT WITH CHECK ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_checklist_items trip_checklist_items_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_checklist_items_select_own ON public.trip_checklist_items FOR SELECT USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_checklist_items trip_checklist_items_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_checklist_items_update_own ON public.trip_checklist_items FOR UPDATE USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_collaborators; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_collaborators ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_day_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_day_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_day_templates trip_day_templates_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_day_templates_owner_delete ON public.trip_day_templates FOR DELETE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: trip_day_templates trip_day_templates_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_day_templates_owner_insert ON public.trip_day_templates FOR INSERT WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: trip_day_templates trip_day_templates_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_day_templates_owner_select ON public.trip_day_templates FOR SELECT USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: trip_day_templates trip_day_templates_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_day_templates_owner_update ON public.trip_day_templates FOR UPDATE USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: trip_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_payments trip_payments_collab_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_payments_collab_delete ON public.trip_payments FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_payments.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status) AND (tc.role = 'editor'::text)))));


--
-- Name: trip_payments trip_payments_collab_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_payments_collab_insert ON public.trip_payments FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_payments.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status) AND (tc.role = 'editor'::text)))));


--
-- Name: trip_payments trip_payments_collab_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_payments_collab_select ON public.trip_payments FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_payments.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status)))));


--
-- Name: trip_payments trip_payments_collab_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_payments_collab_update ON public.trip_payments FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_payments.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status) AND (tc.role = 'editor'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_payments.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status) AND (tc.role = 'editor'::text)))));


--
-- Name: trip_payments trip_payments_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_payments_owner_all ON public.trip_payments USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.owner_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: trip_payments trip_payments_public_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_payments_public_select ON public.trip_payments FOR SELECT USING ((trip_id IN ( SELECT trips.id
   FROM public.trips
  WHERE (trips.is_public = true))));


--
-- Name: trip_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_ride_priorities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_ride_priorities ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_ride_priorities trip_ride_priorities_collab_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_ride_priorities_collab_delete ON public.trip_ride_priorities FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_ride_priorities.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status) AND (tc.role = 'editor'::text)))));


--
-- Name: trip_ride_priorities trip_ride_priorities_collab_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_ride_priorities_collab_insert ON public.trip_ride_priorities FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_ride_priorities.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status) AND (tc.role = 'editor'::text)))));


--
-- Name: trip_ride_priorities trip_ride_priorities_collab_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_ride_priorities_collab_select ON public.trip_ride_priorities FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_ride_priorities.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status)))));


--
-- Name: trip_ride_priorities trip_ride_priorities_collab_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trip_ride_priorities_collab_update ON public.trip_ride_priorities FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_ride_priorities.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status) AND (tc.role = 'editor'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.trip_collaborators tc
  WHERE ((tc.trip_id = trip_ride_priorities.trip_id) AND (tc.user_id = ( SELECT auth.uid() AS uid)) AND (tc.status = 'accepted'::public.invite_status) AND (tc.role = 'editor'::text)))));


--
-- Name: trips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION is_accepted_collaborator(p_trip_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.is_accepted_collaborator(p_trip_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_accepted_collaborator(p_trip_id uuid) TO anon;
GRANT ALL ON FUNCTION private.is_accepted_collaborator(p_trip_id uuid) TO authenticated;
GRANT ALL ON FUNCTION private.is_accepted_collaborator(p_trip_id uuid) TO service_role;


--
-- Name: FUNCTION is_editor(p_trip_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.is_editor(p_trip_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_editor(p_trip_id uuid) TO anon;
GRANT ALL ON FUNCTION private.is_editor(p_trip_id uuid) TO authenticated;
GRANT ALL ON FUNCTION private.is_editor(p_trip_id uuid) TO service_role;


--
-- Name: FUNCTION is_trip_owner(p_trip_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.is_trip_owner(p_trip_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_trip_owner(p_trip_id uuid) TO anon;
GRANT ALL ON FUNCTION private.is_trip_owner(p_trip_id uuid) TO authenticated;
GRANT ALL ON FUNCTION private.is_trip_owner(p_trip_id uuid) TO service_role;


--
-- Name: FUNCTION trips_guard_owner_change(); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.trips_guard_owner_change() FROM PUBLIC;
GRANT ALL ON FUNCTION private.trips_guard_owner_change() TO anon;
GRANT ALL ON FUNCTION private.trips_guard_owner_change() TO authenticated;
GRANT ALL ON FUNCTION private.trips_guard_owner_change() TO service_role;


--
-- Name: FUNCTION append_trip_behaviour_signal(p_trip_id uuid, p_user_id uuid, p_signal jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.append_trip_behaviour_signal(p_trip_id uuid, p_user_id uuid, p_signal jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.append_trip_behaviour_signal(p_trip_id uuid, p_user_id uuid, p_signal jsonb) TO anon;
GRANT ALL ON FUNCTION public.append_trip_behaviour_signal(p_trip_id uuid, p_user_id uuid, p_signal jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.append_trip_behaviour_signal(p_trip_id uuid, p_user_id uuid, p_signal jsonb) TO service_role;


--
-- Name: FUNCTION apply_day_template(p_template_id uuid, p_trip_id uuid, p_date date, p_merge text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.apply_day_template(p_template_id uuid, p_trip_id uuid, p_date date, p_merge text) TO anon;
GRANT ALL ON FUNCTION public.apply_day_template(p_template_id uuid, p_trip_id uuid, p_date date, p_merge text) TO authenticated;
GRANT ALL ON FUNCTION public.apply_day_template(p_template_id uuid, p_trip_id uuid, p_date date, p_merge text) TO service_role;


--
-- Name: FUNCTION current_user_agency_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_user_agency_id() TO anon;
GRANT ALL ON FUNCTION public.current_user_agency_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_user_agency_id() TO service_role;


--
-- Name: FUNCTION current_user_tier(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_user_tier() TO anon;
GRANT ALL ON FUNCTION public.current_user_tier() TO authenticated;
GRANT ALL ON FUNCTION public.current_user_tier() TO service_role;


--
-- Name: FUNCTION duplicate_trip_day(p_trip_id uuid, p_source date, p_targets date[], p_merge text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.duplicate_trip_day(p_trip_id uuid, p_source date, p_targets date[], p_merge text) TO anon;
GRANT ALL ON FUNCTION public.duplicate_trip_day(p_trip_id uuid, p_source date, p_targets date[], p_merge text) TO authenticated;
GRANT ALL ON FUNCTION public.duplicate_trip_day(p_trip_id uuid, p_source date, p_targets date[], p_merge text) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION recalc_profile_trip_stats(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.recalc_profile_trip_stats() TO anon;
GRANT ALL ON FUNCTION public.recalc_profile_trip_stats() TO authenticated;
GRANT ALL ON FUNCTION public.recalc_profile_trip_stats() TO service_role;


--
-- Name: FUNCTION reorder_ride_priority(p_id uuid, p_new_sort_order integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reorder_ride_priority(p_id uuid, p_new_sort_order integer) TO anon;
GRANT ALL ON FUNCTION public.reorder_ride_priority(p_id uuid, p_new_sort_order integer) TO authenticated;
GRANT ALL ON FUNCTION public.reorder_ride_priority(p_id uuid, p_new_sort_order integer) TO service_role;


--
-- Name: FUNCTION save_day_plan_feedback(p_trip_id uuid, p_user_id uuid, p_date text, p_feedback jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_day_plan_feedback(p_trip_id uuid, p_user_id uuid, p_date text, p_feedback jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_day_plan_feedback(p_trip_id uuid, p_user_id uuid, p_date text, p_feedback jsonb) TO anon;
GRANT ALL ON FUNCTION public.save_day_plan_feedback(p_trip_id uuid, p_user_id uuid, p_date text, p_feedback jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_day_plan_feedback(p_trip_id uuid, p_user_id uuid, p_date text, p_feedback jsonb) TO service_role;


--
-- Name: FUNCTION save_trip_planning_profile(p_trip_id uuid, p_user_id uuid, p_profile jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_trip_planning_profile(p_trip_id uuid, p_user_id uuid, p_profile jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_trip_planning_profile(p_trip_id uuid, p_user_id uuid, p_profile jsonb) TO anon;
GRANT ALL ON FUNCTION public.save_trip_planning_profile(p_trip_id uuid, p_user_id uuid, p_profile jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.save_trip_planning_profile(p_trip_id uuid, p_user_id uuid, p_profile jsonb) TO service_role;


--
-- Name: FUNCTION set_trip_day_planning_intent(p_trip_id uuid, p_user_id uuid, p_date text, p_intent jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_trip_day_planning_intent(p_trip_id uuid, p_user_id uuid, p_date text, p_intent jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_trip_day_planning_intent(p_trip_id uuid, p_user_id uuid, p_date text, p_intent jsonb) TO anon;
GRANT ALL ON FUNCTION public.set_trip_day_planning_intent(p_trip_id uuid, p_user_id uuid, p_date text, p_intent jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.set_trip_day_planning_intent(p_trip_id uuid, p_user_id uuid, p_date text, p_intent jsonb) TO service_role;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;


--
-- Name: FUNCTION user_custom_tile_limit(uid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.user_custom_tile_limit(uid uuid) TO anon;
GRANT ALL ON FUNCTION public.user_custom_tile_limit(uid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.user_custom_tile_limit(uid uuid) TO service_role;


--
-- Name: TABLE achievement_definitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.achievement_definitions TO anon;
GRANT ALL ON TABLE public.achievement_definitions TO authenticated;
GRANT ALL ON TABLE public.achievement_definitions TO service_role;


--
-- Name: TABLE achievements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.achievements TO anon;
GRANT ALL ON TABLE public.achievements TO authenticated;
GRANT ALL ON TABLE public.achievements TO service_role;


--
-- Name: TABLE affiliate_clicks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.affiliate_clicks TO anon;
GRANT ALL ON TABLE public.affiliate_clicks TO authenticated;
GRANT ALL ON TABLE public.affiliate_clicks TO service_role;


--
-- Name: TABLE agencies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agencies TO anon;
GRANT ALL ON TABLE public.agencies TO authenticated;
GRANT ALL ON TABLE public.agencies TO service_role;


--
-- Name: TABLE ai_generations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_generations TO anon;
GRANT ALL ON TABLE public.ai_generations TO authenticated;
GRANT ALL ON TABLE public.ai_generations TO service_role;


--
-- Name: TABLE attractions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.attractions TO anon;
GRANT ALL ON TABLE public.attractions TO authenticated;
GRANT ALL ON TABLE public.attractions TO service_role;


--
-- Name: TABLE custom_tiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.custom_tiles TO anon;
GRANT ALL ON TABLE public.custom_tiles TO authenticated;
GRANT ALL ON TABLE public.custom_tiles TO service_role;


--
-- Name: TABLE email_queue; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_queue TO anon;
GRANT ALL ON TABLE public.email_queue TO authenticated;
GRANT ALL ON TABLE public.email_queue TO service_role;


--
-- Name: TABLE feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.feedback TO anon;
GRANT ALL ON TABLE public.feedback TO authenticated;
GRANT ALL ON TABLE public.feedback TO service_role;


--
-- Name: TABLE import_batches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.import_batches TO anon;
GRANT ALL ON TABLE public.import_batches TO authenticated;
GRANT ALL ON TABLE public.import_batches TO service_role;


--
-- Name: TABLE live_wait_current; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.live_wait_current TO service_role;
GRANT SELECT ON TABLE public.live_wait_current TO anon;
GRANT SELECT ON TABLE public.live_wait_current TO authenticated;


--
-- Name: TABLE live_wait_park_mappings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.live_wait_park_mappings TO service_role;


--
-- Name: TABLE live_wait_provider_mappings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.live_wait_provider_mappings TO service_role;


--
-- Name: TABLE live_wait_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.live_wait_snapshots TO service_role;


--
-- Name: TABLE park_areas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.park_areas TO anon;
GRANT ALL ON TABLE public.park_areas TO authenticated;
GRANT ALL ON TABLE public.park_areas TO service_role;


--
-- Name: TABLE park_briefings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.park_briefings TO anon;
GRANT ALL ON TABLE public.park_briefings TO authenticated;
GRANT ALL ON TABLE public.park_briefings TO service_role;


--
-- Name: TABLE parks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.parks TO anon;
GRANT ALL ON TABLE public.parks TO authenticated;
GRANT ALL ON TABLE public.parks TO service_role;


--
-- Name: TABLE region_briefings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.region_briefings TO anon;
GRANT ALL ON TABLE public.region_briefings TO authenticated;
GRANT ALL ON TABLE public.region_briefings TO service_role;


--
-- Name: TABLE region_skip_line_systems; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.region_skip_line_systems TO anon;
GRANT ALL ON TABLE public.region_skip_line_systems TO authenticated;
GRANT ALL ON TABLE public.region_skip_line_systems TO service_role;


--
-- Name: TABLE regions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.regions TO anon;
GRANT ALL ON TABLE public.regions TO authenticated;
GRANT ALL ON TABLE public.regions TO service_role;


--
-- Name: TABLE park_alignment_completeness; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.park_alignment_completeness TO anon;
GRANT ALL ON TABLE public.park_alignment_completeness TO authenticated;
GRANT ALL ON TABLE public.park_alignment_completeness TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE purchases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.purchases TO anon;
GRANT ALL ON TABLE public.purchases TO authenticated;
GRANT ALL ON TABLE public.purchases TO service_role;


--
-- Name: TABLE region_alignment_rollup; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.region_alignment_rollup TO anon;
GRANT ALL ON TABLE public.region_alignment_rollup TO authenticated;
GRANT ALL ON TABLE public.region_alignment_rollup TO service_role;


--
-- Name: TABLE region_data_completeness; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.region_data_completeness TO anon;
GRANT ALL ON TABLE public.region_data_completeness TO authenticated;
GRANT ALL ON TABLE public.region_data_completeness TO service_role;


--
-- Name: TABLE skip_line_systems; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.skip_line_systems TO anon;
GRANT ALL ON TABLE public.skip_line_systems TO authenticated;
GRANT ALL ON TABLE public.skip_line_systems TO service_role;


--
-- Name: TABLE stripe_webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stripe_webhook_events TO anon;
GRANT ALL ON TABLE public.stripe_webhook_events TO authenticated;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;


--
-- Name: TABLE trip_budget_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_budget_items TO anon;
GRANT ALL ON TABLE public.trip_budget_items TO authenticated;
GRANT ALL ON TABLE public.trip_budget_items TO service_role;


--
-- Name: TABLE trip_checklist_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_checklist_items TO anon;
GRANT ALL ON TABLE public.trip_checklist_items TO authenticated;
GRANT ALL ON TABLE public.trip_checklist_items TO service_role;


--
-- Name: TABLE trip_collaborators; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_collaborators TO anon;
GRANT ALL ON TABLE public.trip_collaborators TO authenticated;
GRANT ALL ON TABLE public.trip_collaborators TO service_role;


--
-- Name: TABLE trip_day_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_day_templates TO anon;
GRANT ALL ON TABLE public.trip_day_templates TO authenticated;
GRANT ALL ON TABLE public.trip_day_templates TO service_role;


--
-- Name: TABLE trip_payments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_payments TO anon;
GRANT ALL ON TABLE public.trip_payments TO authenticated;
GRANT ALL ON TABLE public.trip_payments TO service_role;


--
-- Name: TABLE trip_reminders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_reminders TO anon;
GRANT ALL ON TABLE public.trip_reminders TO authenticated;
GRANT ALL ON TABLE public.trip_reminders TO service_role;


--
-- Name: TABLE trip_ride_priorities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trip_ride_priorities TO anon;
GRANT ALL ON TABLE public.trip_ride_priorities TO authenticated;
GRANT ALL ON TABLE public.trip_ride_priorities TO service_role;


--
-- Name: TABLE trips; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.trips TO anon;
GRANT ALL ON TABLE public.trips TO authenticated;
GRANT ALL ON TABLE public.trips TO service_role;


--
--


--
--


--
--


--
--


--
--


--
--


--
-- PostgreSQL database dump complete
--



-- Signup trigger is attached to auth.users, which is outside the public/private dump.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger and internal helpers are not Data API endpoints.
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- Anon may read catalogue and public trips. It does not get write grants on user tables.
revoke insert, update, delete, truncate on table public.profiles from anon;
revoke insert, update, delete, truncate on table public.purchases from anon;
revoke insert, update, delete, truncate on table public.trips from anon;
revoke insert, update, delete, truncate on table public.ai_generations from anon;
revoke insert, update, delete, truncate on table public.email_queue from anon;
revoke all on table public.stripe_webhook_events from anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;
