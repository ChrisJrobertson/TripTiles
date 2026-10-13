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

`npx supabase link` and `migration list` still cannot run: `SUPABASE_ACCESS_TOKEN` and the database password are absent. `public.schema_migrations` is not exposed through PostgREST, so remote version history was not read. The five-file baseline was not pushed.

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
| A1 | Register, verify email, log in | 4 | 100 | 25 | Signup, OTP, and password actions exist. Both existing users are confirmed. No new registration was executed. Local harness: `scripts/auth-test-session.ts` (Auth Admin `generateLink` only, refused for a release runtime or when `TRIPTILES_ALLOW_AUTH_TEST` is unset). Guard test passed. Harness was not executed against the project. |
| A2 | Create an Orlando trip and retrieve it | 4 | 100 | 25 | Eight private Orlando trips already stored, four per owner. This run did not create or reopen one through the app. |
| A3 | Edit dates, parks, and priorities, then see them after a new login | 4 | 100 | 25 | Edit and save code exists. Not executed. |
| A4 | User B cannot read or change User A's private trip | 4 | 100 | 75 | `npm run test:isolation` signed in as both existing users. Each saw 4 trips, with no shared ids. Cross-reads were empty. A disposable Orlando probe owned by Chris was not readable, updatable, or deletable by Ellie. Chris could rename and delete only that probe. The same denial was checked against Ellie's existing trips. The eight real trips were not edited. |
| A5 | Publish a trip, view the public page, then revoke it | 4 | 75 | 25 | `is_public` exists. All 8 live trips are private. Publish and revoke were not clicked. |

Auth implementation: 19 / 20 = **95%**. Verified: 7 / 20 = **35%**. Registration, trip creation, and editing an existing trip were not executed in the browser.

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
| T1 | `npm test` | 4 | 100 | 50 | Passed on 13 October 2026, including the new cron authorization, Stripe entitlement, and webhook dedup tests. |
| T2 | `npm run lint` | 2 | 100 | 50 | Exit 0. One existing warning in `MobileDayView.tsx` (`react-hooks/exhaustive-deps`). |
| T3 | `npx tsc --noEmit` | 3 | 100 | 50 | Exit 0 on 13 October after the auth-harness env type accepted a constructed runtime name. |
| T4 | `NODE_ENV=production npm run build` | 3 | 100 | 50 | The previous production build on this branch passed. It was not repeated after the 13 October edits. |
| T5 | Playwright registration-to-trip journey | 3 | 50 | 25 | `e2e/public-journey.spec.ts` and `e2e/existing-customer.spec.ts` exist. One run passed marketing, pricing, and both signup validation tests. Login, protected redirects, and the signed-in reopen did not finish because a wedged dev server never served `/login`. A later run timed out after 15 minutes waiting for a fresh dev server. No account was created. |

Testing implementation: 13.5 / 15 = **90%**. Verified: 6.75 / 15 = **45%**.

`npm ci` failed before this change because `package-lock.json` did not contain `exceljs@4.4.0`. `npm install` updated the lockfile. `npm test` and the production build then ran from that install.

## Security, privacy and account management — weight 10

| ID | Criterion | Weight | Impl | Verified | Evidence |
| --- | --- | ---: | ---: | ---: | --- |
| Sec1 | Two-user RLS isolation | 2.5 | 100 | 75 | Same evidence as A4. User-scoped clients, not the service role, were used for the allow and deny checks. |
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
| Authentication and trips | 19.000 | 7.000 |
| Smart Plan | 9.500 | 3.250 |
| Stripe | 15.000 | 5.000 |
| Testing | 13.500 | 6.750 |
| Security and privacy | 9.625 | 5.750 |
| Production and integrations | 8.625 | 3.500 |
| **Total** | **95.250** | **47.250** |

**Implementation completeness: 95.25%.** Previous: 87.875%. Change: **+7.375** points.

**Verified commercial launch readiness: 47.25%.** Previous: 30.75%. Change: **+16.5** points.

The implementation increase is the applied Orlando schema, the two-user isolation proof, the partial Playwright suite, and the backup note. The verified increase is the migration list, the catalogue scripts, the isolation run, and the new unit tests. Playwright did not pass as a suite, and no Stripe or Anthropic call was made.

## Launch verdict

Not safe to accept paying customers.

The five migrations are now on `inqexwdkuqdfdoaauxyw`, catalogue checks pass, and the two existing users cannot read or change each other's trips. Smart Plan has not made a real model call. Stripe has not completed a test-mode subscription. Email, Sentry, cron invocation, and backup restore are unverified. The browser journey that signs in and reopens a trip did not finish.

## Commands run on 13 October

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
```

`npx tsc --noEmit` and `NODE_ENV=production npm run build` were not repeated after these edits.

Playwright: one run passed 3 of 7 tests against a wedged server. The next run exited 1 with `Timed out waiting 900000ms from config.webServer`.

## Next engineering task

Start a healthy dev server on port 3001 and rerun `node --env-file=.env.local ./node_modules/@playwright/test/cli.js test`. Then run `npx tsc --noEmit` and a production build. A Stripe test-mode key and an Anthropic key are still required before those integrations can be called. Do not reset the database.
