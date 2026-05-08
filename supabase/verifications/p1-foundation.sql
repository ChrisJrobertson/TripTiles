-- P1 Foundation verification queries

-- 1) Regions metadata columns present
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'regions'
  and column_name in ('has_disney', 'has_universal', 'data_quality_tier')
order by column_name;

-- 2) Skip-line reference tables present
select
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'skip_line_systems'
  ) as has_skip_line_systems,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'region_skip_line_systems'
  ) as has_region_skip_line_systems;

-- 3) Regions tier distribution
select data_quality_tier, count(*)::int as count
from public.regions
group by data_quality_tier
order by data_quality_tier;

-- 4) Disney/Universal region flag coverage
select
  sum(case when has_disney then 1 else 0 end)::int as disney_regions,
  sum(case when has_universal then 1 else 0 end)::int as universal_regions
from public.regions;

-- 5) Every region has at least one skip-line mapping row
select r.id as missing_region_id
from public.regions r
left join public.region_skip_line_systems rsls on rsls.region_id = r.id
where rsls.region_id is null
order by r.id;

-- 6) Featured regions without parks (should be zero)
select
  r.id,
  r.name,
  count(p.id)::int as parks_count
from public.regions r
left join public.parks p on r.id = any(p.region_ids)
where r.is_featured = true
group by r.id, r.name
having count(p.id) = 0
order by r.id;

-- 7) Parks completeness baseline
select
  count(*)::int as total_parks,
  sum(case when name is null or btrim(name) = '' then 1 else 0 end)::int as missing_name,
  sum(case when icon is null or btrim(icon) = '' then 1 else 0 end)::int as missing_icon,
  sum(case when bg_colour is null or btrim(bg_colour) = '' then 1 else 0 end)::int as missing_bg_colour,
  sum(case when fg_colour is null or btrim(fg_colour) = '' then 1 else 0 end)::int as missing_fg_colour,
  sum(case when country is null or btrim(country) = '' then 1 else 0 end)::int as missing_country,
  sum(case when latitude is null then 1 else 0 end)::int as missing_latitude,
  sum(case when longitude is null then 1 else 0 end)::int as missing_longitude,
  sum(case when official_url is null or btrim(official_url) = '' then 1 else 0 end)::int as missing_official_url,
  sum(case when region_ids is null or cardinality(region_ids) = 0 then 1 else 0 end)::int as missing_region_ids,
  sum(case when opens_at is null then 1 else 0 end)::int as missing_opens_at,
  sum(case when closes_at is null then 1 else 0 end)::int as missing_closes_at,
  sum(case when hours_known then 1 else 0 end)::int as parks_with_known_hours
from public.parks;

-- 8) Region completeness view
select *
from public.region_data_completeness
order by region_id;
