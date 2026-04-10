<<<<<<< HEAD
# TripTiles
=======
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database migrations

SQL migrations live in [`supabase/migrations/`](supabase/migrations/). Apply them to your Supabase project using the **SQL Editor** in the dashboard, or with the [Supabase CLI](https://supabase.com/docs/guides/cli) (`supabase db push` / linked projects).

The migration `20260410120000_fix_rls_recursion.sql` replaces recursive Row Level Security policies with `SECURITY DEFINER` helpers. **Apply it (or an equivalent fix) before the planner can load trips** without Postgres error `42P17` (infinite recursion in policy).

To verify the database is reachable and core tables respond to the public Supabase client key (same shape as the planner data path), run:

```bash
npm run smoke
```

Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.local.example`).

The migration `20260410160000_trips_owner_insert_update_delete.sql` adds RLS policies so authenticated users can **insert / update / delete** their own `trips` rows. Apply it (or equivalent policies) so the planner can **persist** assignments and trip details from the app.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result (this repo’s `npm run dev` uses port **3001**).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
>>>>>>> 7f32e4a (Update environment configuration, middleware, and authentication flow)
