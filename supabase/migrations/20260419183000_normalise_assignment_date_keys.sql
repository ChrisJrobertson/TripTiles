-- Normalise JSON date keys to zero-padded YYYY-MM-DD. Safe to run multiple times.

update trips t
set assignments = (
  select coalesce(
    jsonb_object_agg(
      to_char((kv.key)::date, 'YYYY-MM-DD'),
      kv.value
    ),
    '{}'::jsonb
  )
  from jsonb_each(t.assignments) as kv(key, value)
)
where t.assignments is not null
  and jsonb_typeof(t.assignments) = 'object'
  and t.assignments <> '{}'::jsonb;

update trips t
set preferences = jsonb_set(
  coalesce(t.preferences, '{}'::jsonb),
  '{day_notes}',
  (
    select coalesce(
      jsonb_object_agg(
        to_char((kv.key)::date, 'YYYY-MM-DD'),
        kv.value
      ),
      '{}'::jsonb
    )
    from jsonb_each(t.preferences -> 'day_notes') as kv(key, value)
  ),
  true
)
where t.preferences ? 'day_notes'
  and jsonb_typeof(t.preferences -> 'day_notes') = 'object';
