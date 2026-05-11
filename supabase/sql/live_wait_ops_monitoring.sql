-- Live wait subsystem — operational / mapping diagnostics (run in SQL editor).
-- Not applied automatically; safe to keep in repo for operators.

-- Latest ingest activity (approximate): max fetch time on current rows
select provider, max(fetched_at) as last_fetch_at, count(*) as row_count
from live_wait_current
group by provider;

-- Unmapped current rows (need live_wait_provider_mappings)
select external_park_id, external_attraction_id, external_name, wait_minutes, operating_status, observed_at
from live_wait_current
where provider = 'queue_times' and attraction_id is null
order by external_park_id, external_name
limit 100;

-- Top repeated unmapped names
select external_name, count(*) as n
from live_wait_current
where provider = 'queue_times' and attraction_id is null and external_name is not null
group by external_name
order by n desc
limit 25;

-- Current mappings by provider and park
select park_id, external_park_id, count(*) as mapped_attractions
from live_wait_provider_mappings
where provider = 'queue_times' and attraction_id is not null
group by park_id, external_park_id
order by park_id;

-- No successful fetch recently (heuristic — compare to your cron interval)
select *
from live_wait_current
where provider = 'queue_times' and fetched_at < now() - interval '20 minutes'
limit 50;

-- Stale advisory rows by park
select park_id, count(*) as stale_n
from live_wait_current
where stale_after < now() and park_id is not null
group by park_id;

-- Parks with zero mapped live waits (TripTiles parks that appear in current but all null attraction)
select park_id, count(*) filter (where attraction_id is null) as unmapped, count(*) filter (where attraction_id is not null) as mapped
from live_wait_current
where park_id is not null
group by park_id;
