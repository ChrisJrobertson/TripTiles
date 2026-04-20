# TripTiles

Next.js theme park trip planner. Copy [`.env.local.example`](.env.local.example) to `.env.local` and configure Supabase, Anthropic, and **Stripe** subscriptions (`STRIPE_SECRET_KEY`, the four `STRIPE_PRICE_PRO_*` / `STRIPE_PRICE_FAMILY_*` price IDs, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL` for checkout return URLs).

## Database migrations

SQL migrations live in [`supabase/migrations/`](supabase/migrations/). Apply them in the Supabase SQL Editor or with the [Supabase CLI](https://supabase.com/docs/guides/cli).

The migration `20260410120000_fix_rls_recursion.sql` replaces recursive RLS with `SECURITY DEFINER` helpers. Apply it (or an equivalent fix) before the planner can load trips without Postgres error `42P17`.

Stripe subscription support adds `user_subscriptions`, `tripp_usage`, `stripe_webhook_events`, and related columns — see `20260418140000_stripe_subscriptions_tripp_usage.sql`.

## Development

```bash
npm install
npm run dev
```

The dev server uses [http://localhost:3001](http://localhost:3001).

```bash
npm run smoke
```

Smoke tests need valid Supabase env vars (see `.env.local.example`).
