# Current application database inventory

Searched `src/`, `app/`, `scripts/`, `tests/`, and `supabase/` on `main` `a4b8130` for `.from(`, `.rpc(`, and SQL seeds. Objects below are what the canonical baseline keeps because current code or a live policy depends on them.

| DB object | Type | Current code reference | Access | Required? | Evidence |
|---|---|---|---|---|---|
| profiles | table | `src/lib/supabase/profile-read.ts`, settings, Stripe | read/write | yes | signup trigger; planner and billing |
| handle_new_user | trigger function | `scripts/test-handle-new-user-trigger.mjs` | trigger | yes | profile id equals auth user id |
| agencies | table | `src/lib/types.ts` `agency_id` | schema | yes | column mapped on trips and profiles; RLS helpers |
| trips | table | `src/lib/db/trips.ts`, `src/actions/trips.ts` | read/write | yes | planner root |
| trip_collaborators | table | `src/actions/collaborators.ts`, `src/lib/trip-access.ts` | read/write | yes | invites and editor checks |
| purchases | table | `src/lib/stripe/purchase-sync.ts`, `src/lib/tier.ts` | read/write | yes | Stripe purchases |
| stripe_webhook_events | table | `src/app/api/webhooks/stripe/route.ts` | service write | yes | idempotency |
| affiliate_clicks | table | `src/app/api/affiliate/click/route.ts` | service insert | yes | click log |
| parks | table | `src/lib/db/parks.ts` | read | yes | catalogue |
| regions | table | `src/lib/db/regions.ts` | read | yes | catalogue |
| attractions | table | `src/lib/db/attractions.ts` | read | yes | ride catalogue |
| skip_line_systems | table | `scripts/extract-catalogue.ts` | read | yes | skip-line vocabulary |
| region_skip_line_systems | table | `scripts/extract-catalogue.ts` | read | yes | region mapping |
| custom_tiles | table | `src/lib/db/custom-tiles.ts` | read/write | yes | user tiles |
| user_custom_tile_limit | RPC | `src/lib/db/custom-tiles.ts` | RPC | yes | entitlement |
| email_queue | table | `src/lib/email/schedule-trip-emails.ts` | read/write | yes | outbound mail |
| ai_generations | table | `src/lib/db/ai-generations.ts`, `src/actions/ai.ts` | read/write | yes | Smart Plan log |
| achievements | table | `src/actions/achievements.ts` | read/write | yes | user achievements |
| achievement_definitions | table | `src/lib/db/achievements.ts` | read | yes | catalogue |
| feedback | table | `src/actions/feedback.ts` | insert | yes | in-app feedback |
| trip_budget_items | table | `src/actions/budget.ts` | read/write | yes | budget |
| trip_checklist_items | table | `src/actions/checklist.ts` | read/write | yes | checklist |
| trip_payments | table | `src/actions/payments.ts` | read/write | yes | payment schedule |
| trip_reminders | table | `src/lib/trip-reminder-seed.ts` | read/write | yes | reminders |
| trip_day_templates | table | `src/app/api/day-templates/route.ts` | read/write | yes | templates |
| trip_ride_priorities | table | `src/actions/ride-priorities.ts` | read/write | yes | planner rides |
| apply_day_template | RPC | `src/app/api/day-templates/[id]/apply/route.ts` | RPC | yes | template apply |
| duplicate_trip_day | RPC | `src/app/api/trip/[tripId]/day/[date]/duplicate/route.ts` | RPC | yes | day duplicate |
| reorder_ride_priority | RPC | `src/app/api/activity/[id]/position/route.ts` | RPC | yes | reorder |
| set_trip_day_planning_intent | RPC | `src/actions/trips.ts` | RPC | yes | day intent |
| save_trip_planning_profile | RPC | `src/actions/trips.ts` | RPC | yes | planning profile |
| save_day_plan_feedback | RPC | `src/actions/trips.ts` | RPC | yes | day feedback |
| append_trip_behaviour_signal | RPC | `src/actions/trips.ts` | RPC | yes | behaviour signal |
| live_wait_provider_mappings | table | `src/lib/live-wait/ingest-run.ts` | service | yes | ride mapping |
| live_wait_snapshots | table | `src/lib/live-wait/ingest-run.ts` | service insert | yes | history |
| live_wait_current | table | `src/lib/live-wait/current.ts` | read | yes | current waits |
| live_wait_park_mappings | table | `supabase/seeds/live_wait_park_mappings.sql` | service | yes | park mapping |
| import_batches | table | `scripts/import/alignment-import.ts` | service | yes | import log |
| park_areas | table | `scripts/import/alignment-import.ts` | read/write | yes | alignment |
| park_briefings | table | `scripts/verify-florida-catalogue-baseline.ts` | read | yes | alignment |
| region_briefings | table | `scripts/verify-florida-catalogue-baseline.ts` | read | yes | alignment |
| park_alignment_completeness | view | `scripts/report-park-alignment.ts` | read | yes | alignment report |
| region_alignment_rollup | view | `src/lib/types.ts` | read | yes | typed view |
| region_data_completeness | view | `supabase/verifications/p1-foundation.sql` | read | yes | verification |

## Retired after search showed no current reader or writer

`concierge_requests`, `affiliate_conversions`, `park_checkins`, `payhip_products`, `payhip_webhook_events`, `user_subscriptions`, `tripp_usage`, `user_effective_tier`, `user_affiliate_revenue`, `profile_with_stats`, `ai_generations_last_24h`.

No storage bucket or Realtime channel usage was found in `src/`.
