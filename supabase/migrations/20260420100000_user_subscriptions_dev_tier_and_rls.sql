-- Allow product tier "day_tripper" on user_subscriptions for dev/test overrides,
-- and let authenticated users manage rows with no Stripe subscription (dev helper).

alter table public.user_subscriptions
  drop constraint if exists user_subscriptions_tier_check;

alter table public.user_subscriptions
  add constraint user_subscriptions_tier_check
  check (tier in ('day_tripper', 'navigator', 'captain'));

drop policy if exists user_subscriptions_insert_own_null_stripe on public.user_subscriptions;
create policy user_subscriptions_insert_own_null_stripe
  on public.user_subscriptions for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and stripe_subscription_id is null
  );

drop policy if exists user_subscriptions_update_own_null_stripe on public.user_subscriptions;
create policy user_subscriptions_update_own_null_stripe
  on public.user_subscriptions for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and stripe_subscription_id is null
  )
  with check (
    user_id = (select auth.uid())
    and stripe_subscription_id is null
  );

drop policy if exists user_subscriptions_delete_own_null_stripe on public.user_subscriptions;
create policy user_subscriptions_delete_own_null_stripe
  on public.user_subscriptions for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and stripe_subscription_id is null
  );
