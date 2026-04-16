
-- Add destination passport stamps for the new global regions
insert into achievement_definitions (key, title, description, icon, category, threshold, sort_order) values
  ('dest_uk',         'British Adventure',     'Planned a UK trip',                    '🇬🇧', 'destinations', 1, 36),
  ('dest_germany',    'Guten Tag Germany',     'Planned a Germany trip',               '🇩🇪', 'destinations', 1, 37),
  ('dest_spain',      'Hola España',           'Planned a Spain trip',                 '🇪🇸', 'destinations', 1, 38),
  ('dest_uae',        'Desert Adventure',      'Planned a UAE trip',                   '🇦🇪', 'destinations', 1, 39),
  ('dest_shanghai',   'Shanghai Surprise',     'Planned a Shanghai trip',              '🇨🇳', 'destinations', 1, 40),
  ('dest_hongkong',   'Hong Kong Hooray',      'Planned a Hong Kong trip',             '🇭🇰', 'destinations', 1, 41),
  ('dest_singapore',  'Singapore Stopover',    'Planned a Singapore trip',             '🇸🇬', 'destinations', 1, 42),
  ('dest_goldcoast',  'Aussie Adventure',      'Planned an Australia trip',            '🇦🇺', 'destinations', 1, 43),
  ('dest_netherlands','Dutch Delight',         'Planned a Netherlands trip',           '🇳🇱', 'destinations', 1, 44),
  ('dest_denmark',    'Danish Discovery',      'Planned a Denmark trip',               '🇩🇰', 'destinations', 1, 45),
  ('dest_italy',      'Italian Job',           'Planned an Italy trip',                '🇮🇹', 'destinations', 1, 46),
  ('dest_belgium',    'Belgian Break',         'Planned a Belgium trip',               '🇧🇪', 'destinations', 1, 47),
  ('dest_sweden',     'Swedish Story',         'Planned a Sweden trip',                '🇸🇪', 'destinations', 1, 48),
  ('dest_finland',    'Finnish Find',          'Planned a Finland trip',               '🇫🇮', 'destinations', 1, 49),
  ('dest_seoul',      'Annyeong Seoul',        'Planned a South Korea trip',           '🇰🇷', 'destinations', 1, 50),
  ('dest_mexico',     'Hola México',           'Planned a Mexico trip',                '🇲🇽', 'destinations', 1, 51),
  ('dest_toronto',    'O Canada',              'Planned a Canada trip',                '🇨🇦', 'destinations', 1, 52),
  ('dest_lasvegas',   'Viva Las Vegas',        'Planned a Las Vegas trip',             '🎰', 'destinations', 1, 53),
  ('dest_osaka',      'Osaka Adventure',       'Planned an Osaka trip',                '🍣', 'destinations', 1, 54),
  ('dest_sydney',     'Sydney Sights',         'Planned a Sydney trip',                '🇦🇺', 'destinations', 1, 55),
  
  -- Multi-continent achievements
  ('continent_europe',     'European Tour',     'Planned trips in 3+ European destinations',     '🏰', 'destinations', 3, 80),
  ('continent_asia',       'Asian Explorer',    'Planned trips in 3+ Asian destinations',         '🏯', 'destinations', 3, 81),
  ('continent_americas',   'Americas Explorer', 'Planned trips in 3+ Americas destinations',      '🗽', 'destinations', 3, 82),
  ('all_continents',       'World Explorer',    'Planned trips on 4+ different continents',       '🌎', 'destinations', 4, 83),
  ('global_grand_tour',    'Global Grand Tour', 'Planned trips in 10+ different destinations',    '🏆', 'destinations', 10,84)
on conflict (key) do nothing;
;
