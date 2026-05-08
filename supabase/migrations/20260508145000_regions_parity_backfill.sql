update public.regions
set
  has_disney = case
    when id in ('orlando', 'florida_combo', 'cali', 'paris', 'tokyo', 'shanghai', 'hongkong') then true
    else false
  end,
  has_universal = case
    when id in ('orlando', 'florida_combo', 'cali', 'osaka', 'singapore') then true
    else false
  end,
  data_quality_tier = case
    when id in ('orlando', 'florida_combo') then 'deep'
    when id in ('cali', 'paris', 'tokyo', 'shanghai', 'hongkong', 'osaka', 'singapore') then 'standard'
    else 'light'
  end;

insert into public.region_skip_line_systems (region_id, skip_line_system_id)
values
  ('orlando', 'lightning_lane'),
  ('orlando', 'universal_express'),
  ('florida_combo', 'lightning_lane'),
  ('florida_combo', 'universal_express'),
  ('cali', 'lightning_lane'),
  ('cali', 'universal_express'),
  ('paris', 'disneyland_paris_premier_access'),
  ('tokyo', 'tokyo_disney_premier'),
  ('shanghai', 'shanghai_disney_premier'),
  ('hongkong', 'hongkong_disney_premier'),
  ('osaka', 'universal_japan_express'),
  ('singapore', 'universal_singapore_express');

insert into public.region_skip_line_systems (region_id, skip_line_system_id)
select r.id, 'none'
from public.regions r
where r.id not in (
  'orlando',
  'florida_combo',
  'cali',
  'paris',
  'tokyo',
  'shanghai',
  'hongkong',
  'osaka',
  'singapore'
);
