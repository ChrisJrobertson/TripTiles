
-- ============================================================================
-- Adds undo support for Smart Plan generations
--
-- previous_assignments_snapshot stores the assignments JSONB from BEFORE the
-- last Smart Plan ran. When Smart Plan executes, this is populated with the
-- old assignments. When the user clicks "Undo Smart Plan", we restore from
-- here. When the user makes any manual edit afterwards, this is cleared
-- (because the snapshot is now stale and restoring would destroy newer work).
--
-- previous_assignments_snapshot_at tracks WHEN the snapshot was taken so the
-- UI can show "Undo Smart Plan from 2 minutes ago" or similar.
--
-- previous_preferences_snapshot stores the preferences object too, because
-- Smart Plan also writes ai_crowd_summary and ai_day_crowd_notes. Undo
-- should restore those as well to truly return the trip to its prior state.
-- ============================================================================

alter table trips
  add column if not exists previous_assignments_snapshot jsonb,
  add column if not exists previous_preferences_snapshot jsonb,
  add column if not exists previous_assignments_snapshot_at timestamptz;

comment on column trips.previous_assignments_snapshot is 
  'Snapshot of assignments BEFORE the last Smart Plan generation. Used for one-level undo. Cleared when the user makes any manual edit after a Smart Plan run.';

comment on column trips.previous_preferences_snapshot is 
  'Snapshot of preferences (crowd summary, day notes) BEFORE the last Smart Plan. Restored together with assignments on undo.';

comment on column trips.previous_assignments_snapshot_at is
  'Timestamp of when the snapshot was taken. Powers "Undo Smart Plan from N minutes ago" UI.';
;
