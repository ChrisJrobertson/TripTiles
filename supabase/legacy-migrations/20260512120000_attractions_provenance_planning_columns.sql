-- Attractions: provenance + optional planning columns (additive, idempotent).
--
-- Primary vocabulary source: TripTiles attractions completion standard (internal
-- product spec, 2026-05-12) — verification_status, verified_by, skip-line enums
-- aligned with existing chk_attractions_skip_line_* constraints.
--
-- Pre-flight: capture row count before apply (expect unchanged after additive DDL):
--   SELECT count(*) AS attractions_total FROM attractions;
--
-- Existing columns from 20260417120000_attractions_and_ride_selections.sql (not
-- re-added here): best_time_to_ride, is_seasonal, tags (text[] NOT NULL DEFAULT '{}').

-- ---------------------------------------------------------------------------
-- PART 1 — DDL (safe to re-run)
-- ---------------------------------------------------------------------------

alter table attractions
  add column if not exists verification_status text not null default 'unverified'
    constraint attractions_verification_status_check
    check (
      verification_status in ('verified', 'partial', 'unverified', 'retired')
    ),
  add column if not exists verified_at date,
  add column if not exists verified_by text
    constraint attractions_verified_by_check
    check (
      verified_by is null
      or verified_by in ('official_site', 'manual_review', 'community_crowdsource')
    ),
  add column if not exists source_url text,
  add column if not exists height_requirement_accompanied_cm integer,
  add column if not exists min_age_years integer,
  add column if not exists virtual_queue boolean,
  add column if not exists typical_closure_weeks text;

comment on column attractions.verification_status is
  'verified=confirmed from official source, partial=some fields missing, unverified=not checked, retired=no longer operating';
comment on column attractions.verified_at is
  'Date of last verification pass';
comment on column attractions.verified_by is
  'Source type of verification: official_site | manual_review | community_crowdsource';
comment on column attractions.source_url is
  'URL of the specific page data was sourced from — may differ from official_url (attraction page vs data source page)';
comment on column attractions.height_requirement_accompanied_cm is
  'Minimum height in cm when accompanied by a responsible adult; null if not applicable';
comment on column attractions.min_age_years is
  'Minimum age in years; null if no restriction';
comment on column attractions.virtual_queue is
  'TRUE if ride uses virtual boarding groups (e.g. Tron, Guardians). NULL = unknown.';
comment on column attractions.typical_closure_weeks is
  'Typical annual refurb / closure window (free text), null if no known pattern';

comment on column attractions.tags is
  'Operational tags. Allowed values: water_ride, dark_ride, coaster, spinning, motion_sickness_risk, loud, scary, character, nighttime_spectacular (enforce in import scripts; DB does not constrain array elements).';

-- ---------------------------------------------------------------------------
-- PART 2 — Backfill baseline (idempotent)
-- ---------------------------------------------------------------------------

update attractions
set
  verification_status = 'partial',
  verified_by = 'manual_review',
  verified_at = date '2026-05-11',
  source_url = coalesce(source_url, official_url)
where official_url is not null
  and verification_status = 'unverified';

-- ---------------------------------------------------------------------------
-- PART 3 — Proof queries (expect: 0 violations; tags never null)
-- Run after apply to confirm:
--
-- SELECT count(*) AS bad_verification_status
-- FROM attractions
-- WHERE verification_status not in ('verified', 'partial', 'unverified', 'retired');
--   -- expect 0
--
-- SELECT count(*) AS bad_verified_by
-- FROM attractions
-- WHERE verified_by is not null
--   and verified_by not in ('official_site', 'manual_review', 'community_crowdsource');
--   -- expect 0
--
-- SELECT count(*) AS null_tags FROM attractions WHERE tags is null;
--   -- expect 0
--
-- SELECT verification_status, count(*) FROM attractions GROUP BY verification_status ORDER BY 2 desc;
-- ---------------------------------------------------------------------------
