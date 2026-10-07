# Archived TripTiles migrations

These 111 files are the historical migration chain. They are **not** applied by `supabase db reset` or `supabase db push`.

The active chain is `supabase/migrations/`:

- `*_triptiles_schema_baseline.sql`
- `*_triptiles_reference_catalogue.sql`

The historical chain could not be replayed from an empty database (duplicate RLS policies, a Payhip policy that ran before its table existed, `CREATE INDEX CONCURRENTLY` inside a transaction, and a restaurant insert with no primary key). This archive keeps that evidence. Git history also keeps it.

Do not move these files back into `supabase/migrations/` unless you intend to abandon the canonical baseline.
