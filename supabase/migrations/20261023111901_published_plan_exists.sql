-- Published-plan existence check for the public page status.
--
-- Next.js streams a dynamic notFound() as HTTP 200. Middleware needs to return
-- 404 before that render, without a SELECT grant on trips. This function
-- returns only true or false. It does not return notes, ages, payments, or
-- any other column.
--
-- Source: public.trips.public_slug (text, unique) and public.trips.is_public
-- (boolean, default false) in 20261007121619_triptiles_schema_baseline.sql.
-- The slug rule matches src/lib/db/public-trip-read.ts.
--
-- Preflight on 23 October 2026, project inqexwdkuqdfdoaauxyw:
--   select count(*) from public.trips;  -- 9
-- This function inserts and updates nothing. The count stays 9.
--
-- Rollback:
--   revoke all on function public.published_plan_exists(text) from public, anon, authenticated;
--   drop function if exists public.published_plan_exists(text);

create or replace function public.published_plan_exists(lookup_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips
    where public_slug = lookup_slug
      and is_public is true
      and lookup_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      and char_length(lookup_slug) <= 80
  );
$$;

revoke all on function public.published_plan_exists(text) from public, anon, authenticated;
grant execute on function public.published_plan_exists(text) to anon, authenticated;
