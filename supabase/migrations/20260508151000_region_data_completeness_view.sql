create or replace view public.region_data_completeness as
select
  r.id as region_id,
  r.name,
  r.data_quality_tier,
  r.has_disney,
  r.has_universal,
  count(distinct p.id)::int as parks_count,
  coalesce(sum(case when p.hours_known then 1 else 0 end), 0)::int as parks_with_hours,
  array_remove(array_agg(distinct rsl.skip_line_system_id), null) as skip_line_system_ids
from public.regions r
left join public.parks p on r.id = any(p.region_ids)
left join public.region_skip_line_systems rsl on r.id = rsl.region_id
group by r.id, r.name, r.data_quality_tier, r.has_disney, r.has_universal;
