-- Remove unused view: tier is sourced from public.profiles.tier in the app.
-- The view was inconsistent with profiles in production and risked future misuse.
drop view if exists public.user_effective_tier;
