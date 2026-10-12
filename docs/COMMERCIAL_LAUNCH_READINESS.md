# TripTiles commercial launch readiness

Scored 12 October 2026 on branch `cursor/launch-readiness-027e`, starting from `83e4d4e` (`cursor/supabase-clean-baseline`).

Two scores are kept apart:

- **Implementation** — the launch behaviour exists in reviewable code or schema and is wired into the product. 100 means implemented and integrated. 25 means source only. 0 means missing.
- **Verified readiness** — evidence from this run, using the required bands: 0 missing or broken, 25 source only, 50 automated or isolated checks passed, 75 an integrated journey ran, 100 verified in a production-like environment against the criterion.

A criterion contributes `weight × score / 100` points. Category and overall percentages are those points divided by the category weight or by 100.

This is not permission to deploy, enable live charges, or onboard customers.

## Database and data integrity — weight 20

Target project: `inqexwdkuqdfdoaauxyw`. Reads used the project secret key against the REST and Auth Admin APIs. No migration was applied.

Injected `DATABASE_URL` and `SUPABASE_SERVICE_KEY` are for retired project `kdmxevvmmsszqkwbmiko` (pooler host, JWT `ref` decoded locally). They were not used.

`npx supabase link` and `migration list` still cannot run: `SUPABASE_ACCESS_TOKEN` and the database password are absent. `public.schema_migrations` is not exposed through PostgREST, so remote version history was not read. The five-file baseline was not pushed.

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| D1 | Core tables readable on the target project | 4 | 100 | 75 | REST counts: parks 352, attractions 100, regions 43, profiles 2, trips 8, live_wait_park_mappings 146, live_wait_current present in OpenAPI, stripe_webhook_events 0 rows. |
| D2 | Remote migration history matches the five repo files | 4 | 100 | 0 | History unreadable. Push blocked on purpose. |
| D3 | Orlando intelligence objects applied | 4 | 25 | 0 | `20261012150000_orlando_intelligence_foundation.sql` is in the repo. Live API: `park_operating_schedules` and `provider_fetch_log` return PGRST205; `live_wait_park_mappings.match_status` returns 42703. |
| D4 | Auth users have matching profiles | 4 | 100 | 75 | Auth Admin listed 2 confirmed users. Profile ids equal auth ids. Chris Robertson (`chrisjrobertson@outlook.com`, family) and Ellie Robertson (`ellie_robertson@icloud.com`, free). Trigger was not fired for a new signup in this run. |
| D5 | Catalogue validation scripts pass | 4 | 75 | 25 | Rows exist (Magic Kingdom attractions 13, Orlando attractions not fully recounted beyond the 100 total). `verify:orlando-baseline`, `verify:florida-baseline`, and `verify:profiles-schema` were not run: no `.env.local` publishable key. |

Database implementation: 16 / 20 = **80%**. Verified: 7 / 20 = **35%**.

## Authentication, onboarding and trip journeys — weight 20

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| A1 | Register, verify email, log in | 4 | 100 | 25 | Signup, OTP, and password actions exist. Both existing users are confirmed. No new registration was executed. Local harness: `scripts/auth-test-session.ts` (Auth Admin `generateLink` only, refused for a release runtime or when `TRIPTILES_ALLOW_AUTH_TEST` is unset). Guard test passed. Harness was not executed against the project. |
| A2 | Create an Orlando trip and retrieve it | 4 | 100 | 25 | Eight private Orlando trips already stored, four per owner. This run did not create or reopen one through the app. |
| A3 | Edit dates, parks, and priorities, then see them after a new login | 4 | 100 | 25 | Edit and save code exists. Not executed. |
| A4 | User B cannot read or change User A's private trip | 4 | 75 | 0 | Owner policies are in the baseline SQL. Service role can read both users, which does not prove RLS. No second user session was created. |
| A5 | Publish a trip, view the public page, then revoke it | 4 | 75 | 25 | `is_public` exists. All 8 live trips are private. Publish and revoke were not clicked. |

Auth implementation: 18 / 20 = **90%**. Verified: 4 / 20 = **20%**.

## Smart Plan and planning intelligence — weight 10

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| S1 | Authenticated request and subscription-tier gate | 2 | 100 | 25 | `runGenerateAIPlan` checks the user and `assertTierAllows`. Not called with a session. |
| S2 | Real model call, structured output, failure handling, usage limit | 3 | 100 | 25 | Model is `claude-haiku-4-5-20251001`. `ANTHROPIC_API_KEY` is unset, so no live call. Process-local limit is 12 AI calls per user per hour, shared by Smart Plan, day strategy, timeline, must-dos, and tweaks. |
| S3 | Opening hours and weather are not presented as verified when they are not | 3 | 100 | 50 | `npm test` passed `orlando-intelligence.test.ts` and `planner-day-conditions.test.ts`. PDF and calendar copy now say `Typical {month} average, not a live forecast`. |
| S4 | Saved plan still available after a new login | 2 | 75 | 25 | `commitSmartPlan` is implemented and unit-tested. No login-to-login check. |

Smart Plan implementation: 9.5 / 10 = **95%**. Verified: 3.25 / 10 = **32.5%**.

## Stripe payments and subscription lifecycle — weight 15

No Stripe test-mode call was made. `STRIPE_SECRET_KEY` is unset. No charges.

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| P1 | Plan selection and checkout start | 3 | 100 | 25 | `/api/checkout` is in the production build. Not called. |
| P2 | Webhook signature check | 3 | 100 | 25 | `constructEvent` rejects a missing or invalid signature (`src/app/api/webhooks/stripe/route.ts`). Not invoked. |
| P3 | Paid, failed, deleted, and portal events | 4 | 100 | 25 | Handlers exist for `checkout.session.completed`, subscription created/updated/deleted, `invoice.paid`, `invoice.payment_succeeded`, and `invoice.payment_failed`. Customer portal route exists. Not invoked. |
| P4 | A successful payment updates that user's tier | 3 | 100 | 25 | `upsertPurchaseFromStripeSubscription` writes `profiles.tier`, `tier_expires_at`, and Stripe ids for active, trialing, and past_due. Grace and incomplete states leave the tier unchanged. Not executed. |
| P5 | Replay / idempotency | 2 | 100 | 25 | Insert into `stripe_webhook_events` treats unique violation `23505` as a duplicate. Table exists on the target project and has 0 rows. No replay was sent. |

Stripe implementation: 15 / 15 = **100%**. Verified: 3.75 / 15 = **25%**.

## Testing, code quality and browser E2E — weight 15

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| T1 | `npm test` | 4 | 100 | 50 | Passed on 12 October 2026, including new rate-limit, route-guard, auth-harness guard, and weather-copy tests. |
| T2 | `npm run lint` | 2 | 100 | 50 | Exit 0. One existing warning in `MobileDayView.tsx` (`react-hooks/exhaustive-deps`). |
| T3 | `npx tsc --noEmit` | 3 | 100 | 50 | Exit 0 after the auth harness link params were typed. |
| T4 | `NODE_ENV=production npm run build` | 3 | 100 | 50 | Next.js 15.5.15 Turbopack build completed. OpenTelemetry version warnings only. |
| T5 | Playwright registration-to-trip journey | 3 | 0 | 0 | Not added. A browser signup needs the publishable key and a mailbox. A skipped or mocked Playwright test would not verify the journey. |

Testing implementation: 12 / 15 = **80%**. Verified: 6 / 15 = **40%**.

`npm ci` failed before this change because `package-lock.json` did not contain `exceljs@4.4.0`. `npm install` updated the lockfile. `npm test` and the production build then ran from that install.

## Security, privacy and account management — weight 10

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| Sec1 | Two-user RLS isolation | 2.5 | 75 | 0 | Not executed with two user JWTs. Advisors were not run (Supabase CLI and MCP are unauthenticated). |
| Sec2 | Protected routes fail closed when auth cannot be evaluated | 2 | 100 | 75 | `authUnavailableDecision` unit test passed. Production server on port 3001, with no Supabase env: `GET /planner` → 307 `/login?next=%2Fplanner`; `GET /settings/profile` → 307 login; `GET /` and `GET /pricing` → 200. |
| Sec3 | Rate limiting | 1.5 | 75 | 50 | Process-local limiter on sign-in, sign-up, OTP, password reset, and AI actions. Unit test passed. Counters are not shared across serverless isolates. |
| Sec4 | Account export and deletion | 1.5 | 100 | 25 | Settings data-privacy route is in the build. Deletion flow was not run. |
| Sec5 | Webhook verification and dedup | 1.5 | 100 | 25 | Signature check and `stripe_webhook_events` as in P2 and P5. |
| Sec6 | Secrets stay out of the repo | 1 | 100 | 50 | `.env*` is gitignored. `.env.local.example` has empty secret fields. No key was committed. |

Security implementation: 9 / 10 = **90%**. Verified: 3.5 / 10 = **35%**.

## Production configuration, email, live data and monitoring — weight 10

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| Prod1 | Example env points at the confirmed project | 1 | 100 | 50 | `.env.local.example` now uses `https://inqexwdkuqdfdoaauxyw.supabase.co`. Not deployed. |
| Prod2 | Static monthly weather is not labelled as a live forecast | 1.5 | 100 | 50 | Copy test passed. Calendar, PDF, and timeline titles say it is a typical monthly average. |
| Prod3 | Wait times are called live only when every row is LIVE | 1.5 | 100 | 50 | Homepage render contains “Wait times” and does not contain “Live waits”. `/today-at-park` with no database rendered “Park operations” and “Wait times could not be loaded”. The all-rows-LIVE eyebrow was not exercised with provider data. |
| Prod4 | Resend email | 1.5 | 75 | 25 | Resend client and cron route exist. `RESEND_API_KEY` unset. No message sent. |
| Prod5 | Sentry | 1 | 75 | 25 | `sentry.server.config.ts` and `sentry.edge.config.ts` exist. No DSN, so no event was received. |
| Prod6 | Cron authentication | 1 | 100 | 25 | Live-wait and email crons return 401 unless `Authorization: Bearer ${CRON_SECRET}`. Not invoked. `CRON_SECRET` unset. |
| Prod7 | Privacy, terms, export, and deletion surfaces | 1.5 | 100 | 25 | `/privacy`, `/terms`, and `/settings/data-privacy` are in the production build. Not reviewed in a browser session beyond the build. |
| Prod8 | Backup, restore, and rollback procedure | 1 | 0 | 0 | No procedure is documented or tested. Supabase backups were not inspected. |

Production implementation: 8.375 / 10 = **83.75%**. Verified: 3.25 / 10 = **32.5%**.

Marketing notes from this pass:

- Navigation says “Wait times”, not “Live waits”.
- There is a web manifest and no service worker. PWA install is not claimed in this change.
- Affiliate routes exist. This score does not treat them as confirmed commercial partnerships.
- Automatic replanning and What Next were not verified and are not scored as present.

## Overall

| Area | Implementation points | Verified points |
| --- | ---: | ---: |
| Database | 16.000 | 7.000 |
| Authentication and trips | 18.000 | 4.000 |
| Smart Plan | 9.500 | 3.250 |
| Stripe | 15.000 | 3.750 |
| Testing | 12.000 | 6.000 |
| Security and privacy | 9.000 | 3.500 |
| Production and integrations | 8.375 | 3.250 |
| **Total** | **87.875** | **30.750** |

**Implementation completeness: 87.875%.**

**Verified commercial launch readiness: 30.75%.**

Previous scored document: none. This is the first calculated baseline.

## Launch verdict

Not safe to accept paying customers.

The production build and unit tests pass, and the target database has the clean-baseline tables plus two confirmed users and eight private Orlando trips. The Orlando intelligence migration is not applied, migration history cannot be listed, RLS has not been proven between those two users, Smart Plan has not made a real model call, and Stripe has not been exercised in test mode. Email, cron, Sentry, and backup/restore are unverified.

## Commands

```text
npm install
npm test
npm run lint
npx tsc --noEmit
NODE_ENV=production npm run build
NODE_ENV=production npm run start -- --port 3001
```

HTTP checks against that server, with no Supabase environment variables:

- `GET /` → 200, body contains “Wait times”
- `GET /pricing` → 200
- `GET /planner` → 307 `/login?next=%2Fplanner`
- `GET /settings/profile` → 307 `/login?next=%2Fsettings%2Fprofile`
- `GET /today-at-park` → 200, “Park operations”, load error for the missing anon key

## Next engineering task

Get a Supabase access token (or the database password) for `inqexwdkuqdfdoaauxyw`, run `npx supabase migration list --linked`, and compare it with the five files in `supabase/migrations`. If the remote history is the old 12-version chain, stop and reconcile. If it already matches the first four baseline files, apply only `20261012150000_orlando_intelligence_foundation.sql`, then run `verify:profiles-schema`, `verify:orlando-baseline`, and `verify:florida-baseline`. Do not reset the database.
