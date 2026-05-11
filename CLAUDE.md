# TripTiles — AI / agent notes

## Migration discipline rule (May 2026)

No database migration ships without:

1. A primary-source citation for every product/vocabulary claim
2. A SELECT proving every CHECK constraint passes against current data
3. A pre-flight row-count match against expected values, recorded in the migration file as a comment
4. Cursor MUST stop and report between phases — no end-to-end runs without checkpoints
5. UPSERT, never DELETE+INSERT, for catalogue data
6. After any `apply_migration` via Supabase MCP, write a matching idempotent SQL file to `supabase/migrations/` so `db push` stays in sync. Use `IF NOT EXISTS` / `IF EXISTS` clauses so applying it again is a safe no-op.
7. Discover the DB's NOT NULL columns and CHECK constraints (via `information_schema` and `pg_constraint`) BEFORE writing any import payload — never guess at allowed values. The cost of one diagnostic query is always less than the cost of a failed import.
