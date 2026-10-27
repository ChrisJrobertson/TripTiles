# Security remediation (review only)

Draft SQL for isolated validation. **Not** part of the nine October migrations. Do **not** `db push` these files to `inqexwdkuqdfdoaauxyw`.

`supabase db query --local -f` cannot run a multi-statement file (prepared-statement limit). Apply with:

```
docker exec -i supabase_db_TripTiles psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/reviews/20261027160000_profile_purchase_collaborator_hardening.sql
```
