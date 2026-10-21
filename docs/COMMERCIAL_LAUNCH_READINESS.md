# TripTiles commercial launch readiness

Scored 13 October 2026 on branch `cursor/launch-readiness-027e`. The 12 October baseline was implementation **87.875%** and verified readiness **30.75%**.

Two scores are kept apart:

- **Implementation** — the launch behaviour exists in reviewable code or schema and is wired into the product. 100 means implemented and integrated. 25 means source only. 0 means missing.
- **Verified readiness** — evidence from this run, using the required bands: 0 missing or broken, 25 source only, 50 automated or isolated checks passed, 75 an integrated journey ran, 100 verified in a production-like environment against the criterion.

A criterion contributes `weight × score / 100` points. Category and overall percentages are those points divided by the category weight or by 100.

This is not permission to deploy, enable live charges, or onboard customers.

## Database and data integrity — weight 20

Target project: `inqexwdkuqdfdoaauxyw`. The remote history matched the first four baseline files. `20261012150000_orlando_intelligence_foundation.sql` was the only pending file. Preflight counts were parks 352, attractions 100, mappings 146, the 16 Orlando park ids, profiles 2, trips 8. `npx supabase db push --linked --dry-run` listed only that file. It was then applied. Catalogue counts and the eight trips were unchanged afterwards. The disposable RLS probe was deleted; `trips` returned to 8.

Injected `DATABASE_URL` and `SUPABASE_SERVICE_KEY` are for retired project `kdmxevvmmsszqkwbmiko` (pooler host, JWT `ref` decoded locally). They were not used.

`npx supabase migration list --linked` on 15 October showed all five local versions equal to the remote versions, including `20261012150000`. The sentence below that said the history could not be read is out of date.

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| D1 | Core tables readable on the target project | 4 | 100 | 75 | REST counts: parks 352, attractions 100, regions 43, profiles 2, trips 8, live_wait_park_mappings 146, live_wait_current present in OpenAPI, stripe_webhook_events 0 rows. |
| D2 | Remote migration history matches the five repo files | 4 | 100 | 100 | `npx supabase migration list --linked` after the push: all five local versions equal the remote versions, including `20261012150000`. |
| D3 | Orlando intelligence objects applied | 4 | 100 | 75 | `park_operating_schedules` and `provider_fetch_log` exist, both with RLS enabled. Both are empty. `match_status` accepts only the allowed values (`bad_match` 0). Hours have not been ingested. |
| D4 | Auth users have matching profiles | 4 | 100 | 75 | Auth Admin listed 2 confirmed users. Profile ids equal auth ids. Chris Robertson (`chrisjrobertson@outlook.com`, family) and Ellie Robertson (`ellie_robertson@icloud.com`, free). Trigger was not fired for a new signup in this run. |
| D5 | Catalogue validation scripts pass | 4 | 100 | 75 | `verify:profiles-schema`, `verify:orlando-baseline` (44 parks, 60 attractions), and `verify:florida-baseline` passed against `inqexwdkuqdfdoaauxyw` on 13 October. |

Database implementation: 20 / 20 = **100%**. Verified: 16 / 20 = **80%**.

## Authentication, onboarding and trip journeys — weight 20

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| A1 | Register, verify email, log in | 4 | 100 | 50 | `e2e/returning-customer.spec.ts` passed on 21 October against `next start` and project `inqexwdkuqdfdoaauxyw`, commit `7b2945e`. The isolated confirmed account signed in through the login form, signed out, was refused by `/trip/{id}` and `/planner`, then signed in again. Live signup email was not sent again. The 21 October registration evidence still stands, and the combined register-then-login test remains split. Previous verified score 25. |
| A2 | Create an Orlando trip and retrieve it | 4 | 100 | 75 | Same Playwright run created trip `95a460d1-c204-409b-880b-3b092d47cec8` for 6–13 December 2026, 2 adults, must-do parks `mk` and `eu`. After sign-out and a new login the same id, dates, party size, and parks were still on the trip. A later user-scoped read returned `Orlando 2026 revised`, `2026-12-06`–`2026-12-13`, adults 2, parks `mk` and `eu`. Previous verified score 25. |
| A3 | Edit dates, parks, and priorities, then see them after a new login | 4 | 100 | 50 | The same run renamed the trip to `Orlando 2026 revised`, reloaded, and still showed that name. The database row matched. Dates, party size, and parks were checked after the second login and were not edited. Previous verified score 25. |
| A4 | User B cannot read or change User A's private trip | 4 | 100 | 75 | `scripts/verify-e2e-isolation.ts` on 21 October, commit `7b2945e`, used `triptiles-e2e-returning@example.com` and `triptiles-e2e-isolation-b@example.com`. User-scoped REST: owner read 200/1 row; cross-read, cross-update, and cross-delete 200/0 rows; the reverse read was 0 rows. Ride priorities, payments, and budget items were 0 rows for the other user. Anon read of the private trip was 0 rows. Previous verified score 75. The older Chris/Ellie script now refuses to run unless `TRIPTILES_ALLOW_REAL_ACCOUNT_ISOLATION=1`. |
| A5 | Publish a trip, view the public page, then revoke it | 4 | 75 | 25 | The same isolation run set `is_public` and a slug, then cleared them. Anon could read the published row and could not read it after revoke. The public page was not opened. The anon payload included the private note, child ages, and the payment row, so sharing does not yet expose only the public fields. Previous verified score 25. |

Auth implementation: 19 / 20 = **95%**. Verified: 11 / 20 = **55%**. Previous verified 7 / 20.

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
| P4 | A successful payment updates that user's tier | 3 | 100 | 50 | `profileTierActionForSubscription` is what the webhook sync now calls. Unit test: active and trialing set a paid tier; past_due and unpaid in grace, canceled, incomplete, and unknown statuses leave the tier unchanged. No Stripe test payment was made. |
| P5 | Replay / idempotency | 2 | 100 | 50 | `classifyWebhookInsertError` maps Postgres `23505` to duplicate and any other code to failed. The webhook route uses it. No webhook was delivered. `stripe_webhook_events` was not written by this run. |

Stripe implementation: 15 / 15 = **100%**. Verified: 5 / 15 = **33.3%**. No test-mode checkout, portal session, or signed webhook was executed. `STRIPE_SECRET_KEY` is unset.

## Testing, code quality and browser E2E — weight 15

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| T1 | `npm test` | 4 | 100 | 50 | Passed on 21 October 2026, including `auth-redirect-origin.test.ts`, cron authorization, Stripe entitlement, and webhook dedup. |
| T2 | `npm run lint` | 2 | 100 | 50 | Exit 0 on 21 October. The `MobileDayView.tsx` hook warning is gone. |
| T3 | `npx tsc --noEmit` | 3 | 100 | 50 | Exit 0 on 21 October. |
| T4 | `NODE_ENV=production npm run build` | 3 | 100 | 50 | Passed on 21 October, exit 0, after the Organise navigation change. The build lint no longer reported the `MobileDayView.tsx` hook warning. Not a deployed production check, so the score stays 50. |
| T5 | Playwright registration-to-trip journey | 3 | 75 | 75 | `e2e/returning-customer.spec.ts` passed in 1.1 minutes against `next start` on port 3001, commit `7b2945e`. It logged in, created the Orlando trip, opened Organise, signed out, signed in, and saw the renamed trip after reload. `e2e/public-journey.spec.ts` passed 6 tests on the same server. `e2e/first-customer-journey.spec.ts` did not run: live signup email stays behind `TRIPTILES_E2E_ALLOW_SIGNUP_EMAIL=1`. Previous verified score 25. Previous implementation score 50. |

Testing implementation: 14.25 / 15 = **95%**. Verified: 8.25 / 15 = **55%**.

`npm ci` failed before this change because `package-lock.json` did not contain `exceljs@4.4.0`. `npm install` updated the lockfile. `npm test` and the production build then ran from that install.

## Security, privacy and account management — weight 10

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| Sec1 | Two-user RLS isolation | 2.5 | 100 | 75 | Same evidence as A4. User JWTs and the anon key were used for the allow and deny checks. The service role deleted only the e2e probe rows afterwards. |
| Sec2 | Protected routes fail closed when auth cannot be evaluated | 2 | 100 | 75 | `authUnavailableDecision` unit test passed. Production server on port 3001, with no Supabase env: `GET /planner` → 307 `/login?next=%2Fplanner`; `GET /settings/profile` → 307 login; `GET /` and `GET /pricing` → 200. |
| Sec3 | Rate limiting | 1.5 | 75 | 50 | Process-local limiter on sign-in, sign-up, OTP, password reset, and AI actions. Unit test passed. Counters are not shared across serverless isolates. |
| Sec4 | Account export and deletion | 1.5 | 100 | 25 | Settings data-privacy route is in the build. Deletion flow was not run. |
| Sec5 | Webhook verification and dedup | 1.5 | 100 | 50 | Dedup classification is unit-tested and used by the webhook route. `constructEvent` was not called. |
| Sec6 | Secrets stay out of the repo | 1 | 100 | 50 | `.env*` is gitignored. `.env.local.example` has empty secret fields. No key was committed. |

Security implementation: 9.625 / 10 = **96.25%**. Verified: 5.75 / 10 = **57.5%**. Rate limits are still process-local.

## Production configuration, email, live data and monitoring — weight 10

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| Prod1 | Example env points at the confirmed project | 1 | 100 | 50 | `.env.local.example` now uses `https://inqexwdkuqdfdoaauxyw.supabase.co`. Not deployed. |
| Prod2 | Static monthly weather is not labelled as a live forecast | 1.5 | 100 | 50 | Copy test passed. Calendar, PDF, and timeline titles say it is a typical monthly average. |
| Prod3 | Wait times are called live only when every row is LIVE | 1.5 | 100 | 50 | Homepage render contains “Wait times” and does not contain “Live waits”. `/today-at-park` with no database rendered “Park operations” and “Wait times could not be loaded”. The all-rows-LIVE eyebrow was not exercised with provider data. |
| Prod4 | Resend email | 1.5 | 75 | 25 | Resend client and cron route exist. `RESEND_API_KEY` unset. No message sent. |
| Prod5 | Sentry | 1 | 75 | 25 | `sentry.server.config.ts` and `sentry.edge.config.ts` exist. No DSN, so no event was received. |
| Prod6 | Cron authentication | 1 | 100 | 50 | Both cron routes call `isCronAuthorized`. The unit test covers a missing secret, a wrong bearer, and a matching bearer. Neither route was invoked over HTTP. `CRON_SECRET` is unset. |
| Prod7 | Privacy, terms, export, and deletion surfaces | 1.5 | 100 | 25 | `/privacy`, `/terms`, and `/settings/data-privacy` are in the production build. Not reviewed in a browser session beyond the build. |
| Prod8 | Backup, restore, and rollback procedure | 1 | 25 | 0 | `docs/release-backup.md` describes the intended Supabase and Vercel path. No restore or rollback was executed. |

Production implementation: 8.625 / 10 = **86.25%**. Verified: 3.5 / 10 = **35%**.

Marketing notes from this pass:

- Navigation says “Wait times”, not “Live waits”.
- There is a web manifest and no service worker. PWA install is not claimed in this change.
- Affiliate routes exist. This score does not treat them as confirmed commercial partnerships.
- Automatic replanning and What Next were not verified and are not scored as present.

## Overall

| Area | Implementation points | Verified points |
| --- | ---: | ---: |
| Database | 20.000 | 16.000 |
| Authentication and trips | 19.000 | 11.000 |
| Smart Plan | 9.500 | 3.250 |
| Stripe | 15.000 | 5.000 |
| Testing | 14.250 | 8.250 |
| Security and privacy | 9.625 | 5.750 |
| Production and integrations | 8.625 | 3.500 |
| **Total** | **96.000** | **52.750** |

**Implementation completeness: 96%.** Previous: 95.25%. Change: **+0.75** points.

**Verified commercial launch readiness: 52.75%.** Previous: 47.25%. Change: **+5.5** points.

The implementation increase is the passing returning-customer Playwright project. The verified increase is that journey, the second login, the trip rename, and the isolated two-user REST checks. No Stripe or Anthropic call was made.

## Launch verdict

Not safe to accept paying customers.

Private staging for internal testing: **YES.** A production build on port 3001 completed the returning-customer journey against `inqexwdkuqdfdoaauxyw`. Stripe live keys are not set in this environment, and secrets were not committed. A Vercel preview was not created.

Controlled beta: **NO.** Invited users can register and save a manual Orlando trip, but a published trip's anon API response includes private notes, child ages, and payments. Smart Plan has no API key. Account deletion and a hosted confirmation redirect were not exercised.

Full commercial launch: **NO.** There is no Stripe test-mode payment, no real Smart Plan call, no backup restore, and the public-share payload is wider than the public page.

## Commands run on 13–21 October

```text
npx supabase migration list --linked
npx supabase db push --linked --dry-run --skip-vault
npx supabase db push --linked --yes --skip-vault
npm run test:isolation
npm run verify:profiles-schema
npm run verify:orlando-baseline
npm run verify:florida-baseline
npm test
npm run lint
npx tsc --noEmit
NODE_ENV=production npm run build
npx next start -p 3001
node --env-file=.env.local ./node_modules/@playwright/test/cli.js test --project=journey
```

`npx tsc --noEmit` passed on 21 October. `NODE_ENV=production npm run build` passed on 21 October after the Organise navigation change. `npm run test:e2e:returning` passed on 21 October. `scripts/verify-e2e-isolation.ts` passed on 21 October. The registration journey was not run.

Additional commands on 21 October:

```text
npm test
npm run lint
npx tsc --noEmit
NODE_ENV=production npm run build
npm run test:e2e:returning
node --env-file=.env.local ./node_modules/@playwright/test/cli.js test --project=public
node --env-file=.env.local --import tsx scripts/verify-e2e-isolation.ts
```

## Next engineering task

Narrow public trip reads so an anon request for a published trip cannot return notes, child ages, or payments, then open `/plans/{slug}` and revoke the share in the browser. After that, a Stripe test-mode key and an Anthropic key are required before checkout or Smart Plan can be called. Do not send another confirmation email until the Supabase limit has cleared. Do not reset the database.
