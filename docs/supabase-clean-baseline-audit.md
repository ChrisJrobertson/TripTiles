# TripTiles canonical Supabase baseline audit

Historical migrations are archived in `supabase/legacy-migrations/`. They are evidence, not the active chain.

Classification key:

- **A** — introduces an object the current application still needs
- **B** — reference or catalogue data that must survive
- **C** — superseded; the end state is represented by a later change
- **D** — historical repair of drift, a bad import, or a non-replayable insert
- **E** — removes or only existed for functionality that stays removed
- **F** — migration-history placeholder or empty no-op
- **G** — none. Every file was classified from its SQL, not its filename.

Counts: A=54, B=14, C=21, D=7, E=9, F=6

| Migration | Class | Why |
|---|---|---|
| `20260410094342_01_enums_and_profiles.sql` | A | profiles, enums, signup trigger foundation |
| `20260410094352_02_agencies.sql` | A | agencies table; agency_id still on profiles and trips |
| `20260410094402_03_trips.sql` | A | trips table |
| `20260410094413_04_collaborators_and_purchases.sql` | A | collaborators, purchases, canonical provider-order unique index |
| `20260410094427_05_concierge_and_affiliates.sql` | C | affiliate_clicks kept; concierge_requests and affiliate_conversions retired in baseline |
| `20260410094438_06_parks_email_ai.sql` | A | parks, email_queue, ai_generations |
| `20260410094446_07_rls_profiles_agencies.sql` | C | initial RLS, rewritten later |
| `20260410094455_08_rls_trips_collaborators.sql` | C | initial trip RLS, rewritten later |
| `20260410094505_09_rls_remaining_tables.sql` | C | initial remaining RLS, rewritten later |
| `20260410094516_10_views_and_helpers.sql` | E | user_effective_tier later dropped; unused affiliate view and rate-limit function retired |
| `20260410094532_11_harden_update_function.sql` | A | final update_updated_at search_path hardening |
| `20260410094612_12_optimise_rls_policies.sql` | C | policy rewrite superseded by later RLS |
| `20260410120000_fix_rls_recursion.sql` | A | current_user_agency_id and current_user_tier helpers still used by policies |
| `20260410133901_13_seed_parks_data.sql` | B | initial parks catalogue |
| `20260410141305_14_purchases_product_constraint.sql` | E | introduced payhip_products, later dropped; product check evolved |
| `20260410141512_14_fix_rls_recursion.sql` | C | duplicate of 20260410120000; fails replay because policies already exist |
| `20260410141936_15_fix_all_rls_recursion_paths.sql` | C | collaborator helpers superseded when policies were simplified |
| `20260410142623_16_simplify_trips_policies_strip_to_essentials.sql` | C | temporary owner-only trip policy; baseline restores collaborator read |
| `20260410160000_trips_owner_insert_update_delete.sql` | A | owner insert/update/delete with WITH CHECK |
| `20260410160301_17_add_signup_fingerprint_column.sql` | A | column retained; no current app reader |
| `20260410160725_18_gamification_and_account_value.sql` | A | achievements and profile counters; park_checkins retired |
| `20260410161108_19_regions_table_for_global_expansion.sql` | A | regions table |
| `20260410161139_20_seed_parks_uk_germany_spain_netherlands.sql` | B | park catalogue |
| `20260410161212_21_seed_parks_uae_china_hk_singapore_korea.sql` | B | park catalogue |
| `20260410161249_22_seed_parks_australia_canada_mexico_misc.sql` | B | park catalogue |
| `20260410161259_23_universal_parks_to_all_regions.sql` | B | park region_ids update |
| `20260410161351_24_global_destination_achievements.sql` | B | achievement definitions |
| `20260410161405_25_enable_rls_achievement_definitions.sql` | A | RLS on achievement_definitions |
| `20260410195546_26_ai_generations_insert_policy.sql` | C | duplicate of the following AI RLS migration |
| `20260410200000_ai_generations_rls.sql` | A | ai_generations owner policies |
| `20260410223957_27_add_miami_region_and_parks.sql` | B | miami region and parks |
| `20260410224045_28_florida_combo_region.sql` | B | florida combo region |
| `20260410224300_29_uk_cities_multi_destination.sql` | B | UK city regions |
| `20260410224358_30_uk_other_cities_parks.sql` | B | UK city parks |
| `20260410224420_31_uk_universal_and_combo.sql` | B | UK region park and achievement updates |
| `20260410224733_32_custom_user_tiles.sql` | A | custom_tiles and user_custom_tile_limit |
| `20260410233622_33_payments_rls_hardening.sql` | E | Payhip webhook policy; table did not exist yet and was later dropped |
| `20260410235945_34_purchases_insert_policy_defensive.sql` | A | purchases insert policy |
| `20260411101335_35_session_8_rls_collaborators_email_queue.sql` | A | collaborator write policies and email_queue insert |
| `20260411120000_user_tier_premium.sql` | E | Payhip premium tier; later removed from purchases check |
| `20260411130000_public_slug_and_payhip_events.sql` | C | public slug kept; payhip_webhook_events later dropped |
| `20260411170654_36_session_10_feedback_table.sql` | A | feedback |
| `20260411185417_38_undo_smart_plan_snapshot.sql` | A | previous_assignments_snapshot columns |
| `20260411185447_39_cleanup_polluted_region_ids.sql` | D | one-off region_ids repair plus backup column, dropped in baseline |
| `20260411190000_trip_planning_preferences_colour_theme.sql` | A | planning_preferences and colour_theme |
| `20260412120000_budget_checklist_profile_temp.sql` | A | budget, checklist, temperature unit |
| `20260412130655_40_purchases_preserve_on_user_delete.sql` | A | purchases survive user delete |
| `20260412154715_41_ai_generations_add_status.sql` | A | ai_generations.status |
| `20260412170946_42_wizard_planning_preferences_and_colour_theme.sql` | C | duplicate of 20260411190000; constraint already exists |
| `20260412200000_parks_affiliate_named_restaurants.sql` | D | INSERT omitted parks.id and cannot apply; dining copy lives in app code |
| `20260413120000_trip_reminders_gallery_email.sql` | A | trip_reminders, gallery label, email flags |
| `20260414103000_drop_user_effective_tier.sql` | E | drops unused view |
| `20260415140000_add_handle_new_user_trigger_and_backfill.sql` | C | trigger version superseded |
| `20260416130000_profiles_handle_new_user_referral_and_timestamps.sql` | C | handle_new_user version superseded |
| `20260416140000_profiles_column_defaults.sql` | A | profile column defaults |
| `20260416180000_baseline_from_production.sql` | F | history alignment comment plus select 1 |
| `20260417100000_profiles_temperature_unit_if_missing.sql` | D | drift repair for a column already introduced |
| `20260417110000_handle_new_user_set_temperature_unit.sql` | C | handle_new_user version superseded |
| `20260417120000_attractions_and_ride_selections.sql` | A | attractions and trip_ride_priorities |
| `20260417120100_fix_ride_priorities_rls.sql` | A | split collaborator ride-priority policies |
| `20260417120300_profiles_email_marketing_opt_out.sql` | D | drift repair plus another handle_new_user rewrite |
| `20260418120000_trip_payments.sql` | A | trip_payments |
| `20260418140000_stripe_subscriptions_tripp_usage.sql` | C | user_subscriptions and tripp_usage created then dropped |
| `20260419140000_trip_day_templates.sql` | A | trip_day_templates |
| `20260419180000_apply_day_template_rpc.sql` | C | RPC replaced when skip-line columns were added |
| `20260419181000_duplicate_trip_day_rpc.sql` | C | RPC replaced when skip-line columns were added |
| `20260419182000_reorder_ride_priority_rpc.sql` | A | reorder_ride_priority |
| `20260419183000_normalise_assignment_date_keys.sql` | D | one-off JSON key backfill |
| `20260419184000_trip_day_templates_seed_unique.sql` | A | unique template seed name |
| `20260420034708_remote_history_placeholder.sql` | F | empty history placeholder |
| `20260420100000_user_subscriptions_dev_tier_and_rls.sql` | E | policies on a table dropped two migrations later |
| `20260420120000_stripe_v2_cleanup.sql` | E | drops user_subscriptions and tripp_usage; keeps Stripe columns on profiles/purchases |
| `20260420140000_drop_payhip_tables.sql` | E | drops Payhip tables |
| `20260422150000_add_payment_due_dates.sql` | A | trip_payments paid_at and category |
| `20260423120000_stripe_webhook_events_realign.sql` | A | stripe_webhook_events contract used by the webhook handler |
| `20260423200000_purchases_provider_order_unique_draft.sql` | C | CREATE INDEX CONCURRENTLY duplicate of idx_purchases_provider_order |
| `20260424120000_trip_ride_skip_line_return_hhmm.sql` | A | skip-line return window and final-enough RPC column list, later replaced once more |
| `20260424130000_trip_ride_pasted_queue_minutes.sql` | A | pasted queue minutes and final duplicate/apply RPC bodies |
| `20260503120235_drop_premium_from_purchases_product_check.sql` | A | current purchases product check |
| `20260503144500_ai_generations_cancelled_status.sql` | A | cancelled status |
| `20260503190400_add_day_snapshots_to_trips.sql` | A | day_snapshots |
| `20260503214500_add_email_reminders_to_trips.sql` | D | drift repair; column already in an earlier migration |
| `20260503220000_add_gallery_owner_label_to_trips.sql` | D | drift repair; column already in an earlier migration |
| `20260504130000_profiles_preferences_jsonb.sql` | A | profiles.preferences |
| `20260505121000_set_trip_day_planning_intent_rpc.sql` | C | first intent RPC, replaced |
| `20260505133000_fix_day_planning_intent_rpc_noop.sql` | C | intent RPC replaced |
| `20260505142000_fix_day_planning_intent_rpc_user_id_match.sql` | C | intent RPC replaced |
| `20260505173100_set_trip_day_planning_intent_security_definer.sql` | A | final set_trip_day_planning_intent |
| `20260505203000_set_trip_day_planning_intent_security_definer.sql` | F | empty superseded placeholder |
| `20260505210000_fix_day_planning_intent_nested_jsonb.sql` | F | empty superseded placeholder |
| `20260505223100_trip_intelligence_rpc_functions.sql` | A | planning profile, feedback, behaviour RPCs |
| `20260508143000_regions_parity_metadata.sql` | A | region parity columns |
| `20260508144000_skip_line_systems_and_region_mapping.sql` | A | skip_line_systems tables |
| `20260508145000_regions_parity_backfill.sql` | B | region skip-line mapping rows |
| `20260508150000_parks_hours_columns_and_flag.sql` | A | park hours columns |
| `20260508151000_region_data_completeness_view.sql` | A | region_data_completeness view, now security_invoker |
| `20260509120000_park_alignment_infrastructure.sql` | A | import batches, areas, briefings, alignment views |
| `20260511105333_add_parks_enrichment_columns.sql` | A | park enrichment columns |
| `20260511110835_add_ai_generations_observability.sql` | A | ai_generations observability columns |
| `20260511111500_normalise_skip_line_vocabulary.sql` | B | canonical skip-line vocabulary |
| `20260511111600_add_skip_line_check_constraints.sql` | A | skip-line CHECK constraints |
| `20260512120000_attractions_provenance_planning_columns.sql` | A | attraction provenance columns |
| `20260513120000_live_wait_times_subsystem.sql` | A | live wait tables |
| `20260513120001_planner_calendar_pastel_park_colours.sql` | B | park colour updates |
| `20260513202950_live_wait_times_subsystem.sql` | F | duplicate history no-op |
| `20260513202959_live_wait_park_mappings.sql` | F | duplicate history no-op |
| `20260514120000_live_wait_park_mappings.sql` | A | live_wait_park_mappings |
| `20260514202534_add_response_assignments_to_ai_generations.sql` | A | ai_generations.response_assignments |
| `20260614230000_add_stripe_subscription_id.sql` | A | profiles.stripe_subscription_id |
| `20260615000000_retire_wrong_park_dca_attractions.sql` | E | retires two DCA rows; those rows are not in repo seeds so they are absent |
| `20260615120000_harden_handle_new_user_trigger.sql` | A | final handle_new_user |

## Historical debt

### KEEP

Profiles and `handle_new_user`, trips, collaborators, purchases with one provider/order unique index, Stripe webhook events, parks, regions, attractions, skip-line tables, live wait tables, AI generations, email queue, feedback, achievements, custom tiles, day templates, planner RPCs, budget, checklist, payments, reminders.

Agencies stay. `profiles.agency_id` and `trips.agency_id` are part of the typed trip/profile contract, and agency RLS helpers are still referenced by policies. There is no current `.from("agencies")` call.

### CONSOLIDATE

- `purchases_provider_order_unique` dropped. `idx_purchases_provider_order` is the only unique index on `(provider, provider_order_id) WHERE provider_order_id IS NOT NULL`.
- Repeated `handle_new_user`, day-intent, `apply_day_template`, and `duplicate_trip_day` bodies collapsed to their final definitions.
- Repeated RLS rewrites collapsed to the final policies, with collaborator visibility restored.

### RETIRE

- Payhip tables and the Payhip webhook policy that could not replay.
- `user_subscriptions` and `tripp_usage`.
- `user_effective_tier`, `user_affiliate_revenue`, `profile_with_stats`.
- `concierge_requests`, `affiliate_conversions`, `park_checkins`.
- `ai_generations_last_24h`, `user_owns_trip`, `user_collaborator_trip_ids`, `user_editor_trip_ids`.
- `parks.region_ids_backup_pre_cleanup`.
- Open `affiliate_clicks` insert policy (`WITH CHECK (true)`). Inserts go through the service role.

### NOT REPLAYED, AND NOT INVENTED

`20260412200000_parks_affiliate_named_restaurants.sql` inserts parks without `id`. `parks.id` is a `text` primary key with no default, so the statement cannot apply. The same restaurant names are informational copy in `src/data/regional-dining.ts`. No park ids were fabricated.

The two retired DCA attraction ids are not present in `supabase/seeds/`. A clean database therefore does not contain those rows. That matches the retire intent (they must not be active catalogue rows).

## Security changes in the baseline

- RLS is enabled on every `public` base table.
- Accepted collaborators can read a private trip. Editors can update it. A trigger blocks non-owners from changing `owner_id`.
- Owners and pending invitees (matching JWT email) can see collaborator rows. The historical policy `user_id = auth.uid()` hid pending invites from both the owner and the invitee.
- Helpers that would recurse through RLS live in schema `private` as `SECURITY DEFINER` with `search_path = public, pg_temp`.
- Catalogue views use `security_invoker = true`.
- `handle_new_user` is not executable by `anon` or `authenticated`. Execute is granted to `supabase_auth_admin`.
- Anon write grants were revoked on profiles, purchases, trips, ai_generations, and email_queue. `stripe_webhook_events` is service-role only.

