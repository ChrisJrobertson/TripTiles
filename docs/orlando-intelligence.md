# Orlando intelligence foundation

Operational notes for the theme-park data layer. Facts come from providers, the TripTiles catalogue, deterministic code, or explicit user input. This layer does not ask a model for park facts.

## Provider architecture

`ThemeParkDataProvider` in `src/lib/park-data/types.ts` is the contract for parks, live attraction state, and schedules. Adapters:

- `src/lib/park-data/providers/themeparks-wiki.ts` — primary
- `src/lib/park-data/providers/queue-times.ts` — wraps the existing Queue-Times live-wait adapter. It does not invent schedules.

Planner and sequencer code consume normalised hours and waits. They do not read ThemeParks.wiki or Queue-Times payloads.

## Primary and fallback

Environment, when `LIVE_WAIT_PROVIDER` is unset:

1. `THEME_PARK_PRIMARY_PROVIDER` (default `themeparks_wiki`)
2. `THEME_PARK_FALLBACK_PROVIDER` (default `queue_times`, or `none`)
3. Stored TripTiles rows already in the database
4. Unknown, or the marked 09:00–22:00 fallback for a missing schedule

`LIVE_WAIT_PROVIDER` forces a single provider and disables the other. Remove it to ingest both.

Live rows stay stored per provider. The read path picks one winner and records `selection_reason`. It does not average two waits.

A provider error is logged and skipped. Existing rows are left in place. The touring plan still runs.

## Mapping

Park and attraction links live in `live_wait_park_mappings` and `live_wait_provider_mappings`.

Usable statuses: `confirmed_exact`, `manually_approved`. Blank status on older rows is treated as manually approved.

Not used as facts: `candidate`, `missing`, `retired`, `ambiguous`.

Ingestion matches provider entity ids only. Similar names are not mapped, even when two catalogue rides would both look like a match.

Orlando park ids confirmed on 2026-10-06 are in `src/lib/park-data/orlando-parks.ts` and migration `supabase/migrations/20261006140000_orlando_intelligence_foundation.sql`.

## Data ownership

Provider ingestion may refresh live waits, ride status, and date-specific hours (`park_operating_schedules`).

It does not overwrite catalogue thrill, tags, descriptions, planning weights, height, or `parks.latitude` / `parks.longitude`. Provider coordinates are stored on the mapping row as evidence.

`is_indoor = false` is the column default, so it is not treated as proof that a ride is outdoors.

## Provenance and freshness

Provenance kinds: `AUTHORITATIVE_FACT`, `LIVE_OBSERVATION`, `HISTORICAL_OBSERVATION`, `DERIVED_CALCULATION`, `TRIPTILES_RULE`, `USER_INPUT`, `FALLBACK_ASSUMPTION`.

Freshness is `LIVE`, `RECENT`, `STALE`, or `UNKNOWN`.

A wait is LIVE only while `now` is within `stale_after` (default 15 minutes after the provider observation). After that, and for up to six hours, it is RECENT. Older than that, it is STALE. Missing timestamps are UNKNOWN. The UI uses the word “Live” only for LIVE.

Schedules are stale 12 hours after fetch unless `THEME_PARK_SCHEDULE_STALE_AFTER_HOURS` is set. A stale stored schedule can still be used, and it is labelled as stale. A published day with no regular operating window does not fall back to 09:00–22:00.

## Adding a provider

1. Implement `ThemeParkDataProvider`.
2. Register it in `src/lib/park-data/registry.ts`.
3. Add durable id rows to `live_wait_park_mappings`. Do not auto-map ambiguous attractions.
4. Show that provider’s required credit anywhere its data is visible.
5. Add adapter tests for a valid payload, a missing field, a bad HTTP status, invalid JSON, and a timeout.

## Unmapped attractions

Open `/internal/orlando` (staff allowlist) for park coverage, conflicts, and unmapped live rows.

Ride-level suggestions remain on `/internal/live-wait`. Approve a mapping with a `match_status` of `manually_approved` or `confirmed_exact`. Leave ambiguous rows as `ambiguous` so ingestion will not attach them.

## Ingestion

Cron: `GET /api/cron/live-wait-ingest` every five minutes (`vercel.json`), with `Authorization: Bearer $CRON_SECRET`.

Manual:

```bash
npm run live-wait:ingest:dry
node --env-file=.env.local --import tsx scripts/live-wait-ingest.ts
```

`LIVE_WAIT_INGEST_DISABLED=1` skips provider calls and writes.

Live check against ThemeParks.wiki, without writing to the database:

```bash
npx tsx scripts/park-data-live-check.ts
```

## Tests

```bash
npm test
```

The Orlando suite is `src/lib/park-data/orlando-intelligence.test.ts`.

## ThemeParks.wiki notes (verified 2026-10-06)

- Base URL: `https://api.themeparks.wiki/v1`
- Used: `/destinations`, `/entity/{id}/live`, `/entity/{id}/schedule`
- No API key is required for those calls. `THEMEPARKS_WIKI_API_KEY` is optional and sent as `x-api-key`.
- Credit: “Powered by ThemeParks.wiki” when the data is shown.
- Handle HTTP 429 and `Retry-After`. Do not poll live data faster than about once a minute per park.
- A missing standby wait is null, not zero. An attraction absent from `liveData` is not marked closed.
