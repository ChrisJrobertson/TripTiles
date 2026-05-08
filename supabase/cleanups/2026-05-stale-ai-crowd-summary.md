# Stale `ai_crowd_summary` cleanup (optional)

Run only after reviewing counts against production. Render-time resolvers already hide apologetic copy on key surfaces; this clears bad strings from `trips.preferences`.

## Patterns (ILIKE)

- `%no specific crowd data%`
- `%with no specific%`
- `%unfortunately%`
- `%as an ai%`
- `%i don't have%` / `%i don''t have%` in SQL
- `%we're sorry%` / `%we''re sorry%`
- `%i apologize%` / `%i apologise%`

## Count

```sql
SELECT region_id, COUNT(*) AS affected_trips
FROM trips
WHERE preferences->>'ai_crowd_summary' ILIKE ANY (
  ARRAY[
    '%no specific crowd data%',
    '%with no specific%',
    '%unfortunately%',
    '%as an ai%',
    '%i don''t have%',
    '%we''re sorry%',
    '%i apologize%',
    '%i apologise%'
  ]
)
GROUP BY region_id
ORDER BY affected_trips DESC;
```

## Update (destructive)

```sql
UPDATE trips
SET preferences = jsonb_set(
  preferences,
  '{ai_crowd_summary}',
  '""'::jsonb
)
WHERE preferences->>'ai_crowd_summary' ILIKE ANY (
  ARRAY[
    '%no specific crowd data%',
    '%with no specific%',
    '%unfortunately%',
    '%as an ai%',
    '%i don''t have%',
    '%we''re sorry%',
    '%i apologize%',
    '%i apologise%'
  ]
);
```

Repeat for `ai_day_crowd_notes` values if previews show the same phrasing (JSON object: consider per-key updates in application code or `jsonb_each`).

## Audit trail

- Documented in repo: 2026-05-08
- Live `UPDATE` execution: operator to record here after run (project / user / count).
