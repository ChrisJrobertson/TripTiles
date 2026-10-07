-- DO NOT apply via CLI; will be applied via Supabase MCP after human review.
--
-- `CREATE INDEX CONCURRENTLY` cannot run inside a standard transactional
-- `supabase db push` migration on some hosts. Prefer running this statement
-- by hand in the Supabase SQL editor after verifying no duplicate
-- (provider, provider_order_id) pairs exist.
--
-- Add unique constraint so the webhook handler can use a proper upsert
-- Safety: check there are no dupes before this runs

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
  purchases_provider_order_unique
  ON public.purchases (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;
