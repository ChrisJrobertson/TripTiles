-- Phase 1: Add enrichment_status and notes columns to parks
-- These are additive only — no existing data is touched.
-- NO CHECK constraint yet — that comes in Phase 5 after data is loaded.

ALTER TABLE parks
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN parks.enrichment_status IS
  'Provenance tag: verified=real data confirmed from official source; template=itinerary placeholder with no real location; no_fixed_hours=real place but no fixed opening/closing time; seasonal=hours vary by season; unverified=not yet enriched.';

COMMENT ON COLUMN parks.notes IS
  'Editorial notes from enrichment pass.';
