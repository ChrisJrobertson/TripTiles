# Database migration workflow (TripTiles)

## Principles

1. **All schema changes** go through SQL migration files committed under `supabase/migrations/`. That is the source of truth for how the database evolved.

2. **Do not change production** in the Supabase SQL Editor unless you **immediately** capture the same change in a migration file and merge it to `main`. Ad-hoc SQL and repo migrations drifting apart caused the “remote has versions the repo doesn’t” problem.

3. **Apply new migrations** with the Supabase CLI against the right target:

   ```bash
   npx supabase db push --linked --yes
   ```

   Prefer `db push` for normal forward migrations. Avoid `supabase db query --linked` for routine DDL; reserve it for emergencies or one-offs that you then formalize into a migration.

4. **If `db push` fails because of drift** (local files vs `supabase_migrations.schema_migrations` don’t line up):

   - Run `npx supabase migration list --linked` and fix the mismatch.
   - Prefer `npx supabase migration fetch --linked` to pull missing migration **files** from the remote history table into `supabase/migrations/`.
   - Use `npx supabase migration repair --status applied|reverted --linked <version>…` only when you know the database already matches what those versions represent (for example, a migration was applied manually but never recorded).
   - After histories match, run `db pull` **if Docker is available** (shadow DB) to generate a new migration from any remaining diff; or add a focused migration file by hand.
   - Then run `db push` again.

5. **Docker**: `supabase db pull` and `supabase db dump --linked` expect a working Docker daemon (shadow database / tooling). If Docker isn’t running, use `migration fetch` + `migration repair` + normal migration files, or run pull/dump on a machine that has Docker.

## Verifying after migration work

- `npx supabase migration list --linked` — local and remote columns should match row-for-row.
- `npx supabase db push --linked` — should report nothing pending once everything is applied.
- Smoke: `node scripts/count-orphan-auth-users.mjs` and `node scripts/test-handle-new-user-trigger.mjs` when touching auth/profiles.
- **Profiles / app reads:** before shipping UI that selects new `profiles` columns, add a migration and run `npm run verify:profiles-schema` (or `node scripts/verify-profiles-columns.mjs`) against staging and production. That script uses the same column list as planner/settings reads; if PostgREST reports “column does not exist”, deploy migrations first. When you add a required column for new users, update `public.handle_new_user()` in a migration so signups do not rely on defaults alone.

## Canonical baseline

The active chain is three files under `supabase/migrations/`:

- `*_triptiles_schema_baseline.sql`
- `*_triptiles_reference_catalogue.sql`
- `*_harden_security_definer_and_fk_indexes.sql`

They replace the 111-file historical chain. That history is archived in `supabase/legacy-migrations/` and is not applied by `db reset` or `db push`. See `docs/supabase-clean-baseline-audit.md`.

The new baseline supersedes the historical reconstruction chain. Do not replay the archive onto a new database, and do not `db push` those files. A replacement project is rebuilt by resetting migration history and pushing only the three active files.

A clean database is built with:

```bash
npx supabase db reset --local --no-seed
```

Do not move the archived files back into `supabase/migrations/`.
