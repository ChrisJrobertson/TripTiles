# Pre-launch priority status

## Priority 1 — Canonical profile tier read and explicit failures

**Acceptance (open until verified):** Priority 1 is **not closed** until you confirm on the **deployed staging environment** with your **Pro** account that the tier resolves correctly: the UI shows **Pro** (not Free, not **Plan unknown**). If you see **Plan unknown**, Priority 1 stays **open** and we diagnose why the `profiles` fetch is failing (session, RLS, missing row, or network).

**Staging deploy:** Use the Vercel preview/staging workflow your team uses for this repo; deploy the branch that includes the P1 fix before testing.

## Priority 4 — Mobile planner dock at 1288px

**Status: closed — not reproducible.** `MobilePlannerDock` uses `hidden md:block lg:hidden`, so it only renders between **768px and 1023px**; at **1288px** it is hidden (Tailwind `lg` breakpoint). Breakpoints are correct; **no code change** was made for P4.

## Priority 2 — Hydration error

Start after Priority 1 is accepted (staging Pro account check passes).

---

## Diagnostic follow-up (Priority 1)

### Orphan auth users (no `profiles` row)

Run in Supabase SQL Editor (or use `node scripts/count-orphan-auth-users.mjs`, which uses the Auth Admin API plus `profiles` lookups):

```sql
select count(*) from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
```

**Current project (live DB, via script):** `auth.users` = 6, **orphans = 1** (user id `638774b4-b4f7-42d5-a420-c7d9a97b294e`, created `2026-04-10`).

**Why there is no trigger in this repo:** There is no `handle_new_user` (or equivalent) migration in version-controlled SQL. Profile rows are usually created by a Supabase **database trigger on `auth.users`**. If that trigger was never applied to this project, was dropped, or a user was created via a path that did not fire it (manual Admin API import, partial migration, etc.), you get orphans.

**Backfill plan (run once in SQL Editor after confirming `profiles` columns and defaults in Table Editor):**

1. Inspect `public.profiles` for `NOT NULL` columns and defaults (e.g. `referral_code`, `tier`).
2. Insert one row per orphan user, typically `tier = 'free'`, `email` from `auth.users.email`, and any required fields your schema enforces.
3. Optionally add a **persistent** `on_auth_user_created` trigger + function in a new migration (Supabase docs: “User management”) so new sign-ups always get a profile row.

Re-test orphans with `node scripts/count-orphan-auth-users.mjs` until the count is 0.

### `user_effective_tier` view

Removed by migration `20260414103000_drop_user_effective_tier.sql`. Apply migrations to staging and production so the view is dropped everywhere the app connects.
