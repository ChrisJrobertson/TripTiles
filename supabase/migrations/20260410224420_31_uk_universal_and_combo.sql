
-- Add travel/dining/activities/excursions tiles to all new UK city regions
update parks
set region_ids = region_ids || array[
  'london','edinburgh','bath','liverpool','york','manchester',
  'cambridge','lakedist','cornwall','highlands','cardiff',
  'belfast','brighton','stratfm','uk_combo'
]::text[]
where park_group in ('travel', 'dining', 'activities', 'excursions')
  and not ('london' = any(region_ids));  -- avoid duplicates on re-run

-- UK Combo region includes parks from ALL UK destinations
update parks
set region_ids = array_append(region_ids, 'uk_combo')
where not ('uk_combo' = any(region_ids))
  and (
    'uk' = any(region_ids) or
    'london' = any(region_ids) or
    'edinburgh' = any(region_ids) or
    'bath' = any(region_ids) or
    'liverpool' = any(region_ids) or
    'york' = any(region_ids) or
    'manchester' = any(region_ids) or
    'cambridge' = any(region_ids) or
    'lakedist' = any(region_ids) or
    'cornwall' = any(region_ids) or
    'highlands' = any(region_ids) or
    'cardiff' = any(region_ids) or
    'belfast' = any(region_ids) or
    'brighton' = any(region_ids) or
    'stratfm' = any(region_ids)
  );

-- Add destination passport stamps for new UK cities
insert into achievement_definitions (key, title, description, icon, category, threshold, sort_order) values
  ('dest_london',     'London Calling',        'Planned a London trip',              '🎡', 'destinations', 1, 60),
  ('dest_edinburgh',  'Auld Reekie',           'Planned an Edinburgh trip',          '🏰', 'destinations', 1, 61),
  ('dest_bath',       'Bath Time',             'Planned a Bath & Cotswolds trip',    '♨️', 'destinations', 1, 62),
  ('dest_liverpool',  'Fab Four',              'Planned a Liverpool trip',           '🎸', 'destinations', 1, 63),
  ('dest_york',       'Viking Spirit',         'Planned a York trip',                '⛪', 'destinations', 1, 64),
  ('dest_manchester', 'Manchester United',     'Planned a Manchester trip',          '⚽', 'destinations', 1, 65),
  ('dest_cambridge',  'Dreaming Spires',       'Planned a Cambridge or Oxford trip', '🎓', 'destinations', 1, 66),
  ('dest_lakedist',   'Lake Life',             'Planned a Lake District trip',       '🏞️', 'destinations', 1, 67),
  ('dest_cornwall',   'Cornish Pasty',         'Planned a Cornwall trip',            '🌊', 'destinations', 1, 68),
  ('dest_highlands',  'Highland Fling',        'Planned a Scottish Highlands trip',  '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'destinations', 1, 69),
  ('dest_cardiff',    'Welsh Wonder',          'Planned a Cardiff or Wales trip',    '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'destinations', 1, 70),
  ('dest_belfast',    'Northern Star',         'Planned a Belfast trip',             '⚓', 'destinations', 1, 71),
  ('dest_brighton',   'Brighton Rock',         'Planned a Brighton trip',            '🎠', 'destinations', 1, 72),
  ('dest_stratfm',    'To Be Or Not',          'Planned a Stratford trip',           '🎭', 'destinations', 1, 73),
  ('dest_uk_combo',   'Grand British Tour',    'Planned a multi-city UK holiday',    '🇬🇧', 'destinations', 1, 74)
on conflict (key) do nothing;
;
