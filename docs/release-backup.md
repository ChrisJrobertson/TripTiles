# Backup, restore, and rollback

This procedure is documented so a release has a known path. It has not been executed as a restore drill. Do not treat it as a proven recovery.

## Database

The application database is Supabase project `inqexwdkuqdfdoaauxyw`.

- Point-in-time recovery and daily backups are a Supabase plan feature. Confirm the plan in the Supabase dashboard before relying on them.
- Schema changes ship only as files in `supabase/migrations/`. Apply with `npx supabase db push --linked` after `npx supabase db push --linked --dry-run` shows the intended file and the migration's preflight counts match.
- Do not run `supabase db reset` against the linked project. The historical chain in `supabase/legacy-migrations/` is not replay-safe.

A restore that has not been rehearsed is not evidence that customer data can be recovered.

## Application

- Production deploys go through Vercel. Roll back by promoting the previous successful deployment in the Vercel dashboard. Do not deploy from this repository with `npm run deploy:vercel` unless that release was requested.
- The five-minute live-wait cron in `vercel.json` is incompatible with a Vercel Hobby plan. Leaving it in place is intentional. Removing it, or changing it to once a day, needs a separate decision.

## What this does not cover

- A tested restore of `trips` or `profiles`.
- A tested Vercel rollback.
- Off-platform database dumps.
