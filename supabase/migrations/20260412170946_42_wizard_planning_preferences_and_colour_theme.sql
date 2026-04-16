
-- ============================================================
-- Migration 42: Trip Creation Wizard — planning preferences + colour themes
-- ============================================================

-- 1. planning_preferences JSONB on trips
--    Stores the AI-path wizard answers so they survive regeneration.
--    Shape: { pace, mustDoParks, priorities, additionalNotes, adults, children, childAges }
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS planning_preferences jsonb
    DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.trips.planning_preferences IS
  'AI wizard preferences (pace, must-do parks, priorities, additional notes, family composition). Used to seed and re-seed Smart Plan generation.';

-- 2. colour_theme TEXT on trips (per-trip theming)
--    Valid keys: classic, pastel, sunset, ocean, garden, berry
--    Default: classic (the existing brand colours)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS colour_theme text
    NOT NULL DEFAULT 'classic';

-- Constrain to known theme keys
ALTER TABLE public.trips
  ADD CONSTRAINT trips_colour_theme_check
    CHECK (colour_theme = ANY (ARRAY[
      'classic'::text,
      'pastel'::text,
      'sunset'::text,
      'ocean'::text,
      'garden'::text,
      'berry'::text
    ]));

COMMENT ON COLUMN public.trips.colour_theme IS
  'User-chosen colour theme key for the planner UI. One of: classic, pastel, sunset, ocean, garden, berry.';

-- No new RLS policies needed — the existing row-level policies on trips
-- (owner_id = auth.uid()) already cover all columns including the new ones.
;
