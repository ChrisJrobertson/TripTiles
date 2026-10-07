-- AI usage log: authenticated users must be able to INSERT and SELECT their own
-- rows (server actions use the user session + anon key, so RLS applies).
--
-- Apply: Supabase Dashboard → SQL → New query → paste → Run,
-- or: supabase db push / migration up from CLI.

alter table public.ai_generations enable row level security;

drop policy if exists "AI generations insert own" on public.ai_generations;
create policy "AI generations insert own"
  on public.ai_generations
  for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "AI generations select own" on public.ai_generations;
create policy "AI generations select own"
  on public.ai_generations
  for select
  using ((select auth.uid()) = user_id);
