-- Per-trip wizard planning preferences (Smart Plan context) and colour theme.
-- RLS unchanged: inherits trips row owner policies.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS planning_preferences jsonb,
  ADD COLUMN IF NOT EXISTS colour_theme text NOT NULL DEFAULT 'classic';

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_colour_theme_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_colour_theme_check CHECK (
    colour_theme IN (
      'classic',
      'pastel',
      'sunset',
      'ocean',
      'garden',
      'berry'
    )
  );

COMMENT ON COLUMN public.trips.planning_preferences IS
  'Structured Smart Plan wizard answers: pace, must-do park ids, priority tags, notes, party snapshot.';
COMMENT ON COLUMN public.trips.colour_theme IS
  'Planner UI palette preset key (classic, pastel, sunset, ocean, garden, berry).';
