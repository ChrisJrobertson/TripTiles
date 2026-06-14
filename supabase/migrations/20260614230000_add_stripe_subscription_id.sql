-- Add Stripe subscription id on profiles for webhook user resolution and lifecycle sync.

alter table public.profiles
  add column if not exists stripe_subscription_id text;

notify pgrst, 'reload schema';
