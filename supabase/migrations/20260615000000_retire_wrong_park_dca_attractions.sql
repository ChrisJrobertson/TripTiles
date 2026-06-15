-- Migration: retire two DCA attractions that are incorrectly assigned to this park.
--
-- Pre-flight (recorded 2026-06-15):
--   - attractions table CHECK constraint includes 'retired' as valid verification_status
--   - dca-philharmagic: verification_status = 'unverified' (row exists, wrong park)
--   - dca-soarin-over-california: verification_status = 'unverified' (row exists, superseded film)
--   - retired_count before migration: 0
--
-- Reason for dca-philharmagic:
--   Mickey's PhilharMagic does not operate at Disney California Adventure.
--   It operates at Magic Kingdom (mk-philharmagic), Disneyland Paris, Hong Kong Disneyland,
--   and Tokyo Disneyland. The DCA entry is incorrect. Source: official park attraction pages.
--
-- Reason for dca-soarin-over-california:
--   "Soarin' Over California" was replaced by "Soarin' Around the World" at DCA in 2016.
--   The current operating attraction is dca-soarin (Soarin' Around the World).
--   Having both entries causes the model to treat them as two separate sequenceable experiences.
--   Source: Disney Parks official history.
--
-- Idempotent: UPDATE with WHERE clause is safe to re-run.

UPDATE attractions
SET verification_status = 'retired',
    updated_at = NOW()
WHERE id = 'dca-philharmagic'
  AND verification_status != 'retired'; -- no-op if already retired

UPDATE attractions
SET verification_status = 'retired',
    updated_at = NOW()
WHERE id = 'dca-soarin-over-california'
  AND verification_status != 'retired'; -- no-op if already retired
