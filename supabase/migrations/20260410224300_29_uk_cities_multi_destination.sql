
-- ============================================================================
-- UK city regions for multi-destination British holidays
-- Existing 'uk' region stays as the theme-park umbrella (Alton Towers, etc)
-- New city regions are specific to London, Edinburgh, Bath, etc
-- ============================================================================

insert into regions (id, name, short_name, country, country_code, continent, flag_emoji, description, is_featured, sort_order) values
  ('london',     'London',                       'London',      'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Harry Potter Studios, West End, Tower of London and the big ten landmarks', true,  100),
  ('edinburgh',  'Edinburgh & Scotland',         'Edinburgh',   'United Kingdom', 'GB', 'Europe', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Royal Mile, Edinburgh Castle, Harry Potter tourism, Highlands day trips', true,  101),
  ('bath',       'Bath & the Cotswolds',         'Bath',        'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Roman Baths, Jane Austen, Bridgerton filming locations, Cotswold villages', false, 102),
  ('liverpool',  'Liverpool',                    'Liverpool',   'United Kingdom', 'GB', 'Europe', '🇬🇧', 'The Beatles, Anfield, Albert Dock, Tate Liverpool', false, 103),
  ('york',       'York',                         'York',        'United Kingdom', 'GB', 'Europe', '🇬🇧', 'The Shambles, Jorvik Viking Centre, Railway Museum, Harry Potter', false, 104),
  ('manchester', 'Manchester',                   'Manchester',  'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Football heritage, Science Museum, Lake District gateway', false, 105),
  ('cambridge',  'Cambridge & Oxford',           'Cam/Ox',      'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Punting, university colleges, Harry Potter filming locations', false, 106),
  ('lakedist',   'Lake District',                'Lakes',       'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Peter Rabbit, Beatrix Potter, hiking, Windermere and Wastwater', false, 107),
  ('cornwall',   'Cornwall',                     'Cornwall',    'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Eden Project, Lands End, beaches, Poldark country', false, 108),
  ('highlands',  'Scottish Highlands',           'Highlands',   'United Kingdom', 'GB', 'Europe', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Loch Ness, Isle of Skye, Glenfinnan Viaduct, Glencoe', false, 109),
  ('cardiff',    'Cardiff & Wales',              'Cardiff',     'United Kingdom', 'GB', 'Europe', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Doctor Who, Cardiff Castle, Brecon Beacons, Snowdonia', false, 110),
  ('belfast',    'Belfast & Northern Ireland',   'Belfast',     'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Titanic Quarter, Giant''s Causeway, Game of Thrones tours', false, 111),
  ('brighton',   'Brighton',                     'Brighton',    'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Royal Pavilion, Palace Pier, Lanes shopping, day trip from London', false, 112),
  ('stratfm',    'Stratford & Warwick',          'Stratford',   'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Shakespeare''s birthplace, Warwick Castle, Kenilworth Castle', false, 113),
  
  -- UK combo region for multi-city British holidays
  ('uk_combo',   'UK Multi-City Tour',           'UK Tour',     'United Kingdom', 'GB', 'Europe', '🇬🇧', 'Build a Great British tour across multiple cities and regions', true,  120)

on conflict (id) do nothing;

-- ============================================================================
-- Seed parks/attractions for LONDON (the big one - comprehensive)
-- ============================================================================

insert into parks (id, name, icon, bg_colour, fg_colour, park_group, destinations, region_ids, sort_order) values

-- Theme parks & attractions near/in London
('warnstud', 'Harry Potter Studio Tour',  null, '#1A1A2E', '#FFD700', 'attractions', array['custom']::destination[], array['london'], 800),
('towerlon', 'Tower of London',           null, '#8B0000', '#F5D76E', 'attractions', array['custom']::destination[], array['london'], 801),
('lonbridge','Tower Bridge',              null, '#003D82', '#FFD700', 'sights',      array['custom']::destination[], array['london'], 802),
('westab',   'Westminster Abbey',         null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['london'], 803),
('bigben',   'Big Ben & Parliament',      null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['london'], 804),
('buckpal',  'Buckingham Palace',         null, '#8B0000', '#FFD700', 'sights',      array['custom']::destination[], array['london'], 805),
('trafals',  'Trafalgar Square',          null, '#1A1A2E', '#FFD700', 'sights',      array['custom']::destination[], array['london'], 806),
('londeye',  'London Eye',                null, '#003D82', '#FFFFFF', 'attractions', array['custom']::destination[], array['london'], 807),
('tatemod',  'Tate Modern',               null, '#5C1F00', '#FFFFFF', 'sights',      array['custom']::destination[], array['london'], 808),
('natgal',   'National Gallery',          null, '#8B6914', '#FFFFFF', 'sights',      array['custom']::destination[], array['london'], 809),
('natmus',   'Natural History Museum',    null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['london'], 810),
('scimus',   'Science Museum London',     null, '#1E6091', '#FFD700', 'attractions', array['custom']::destination[], array['london'], 811),
('vaam',     'V&A Museum',                null, '#8B0000', '#F5D76E', 'sights',      array['custom']::destination[], array['london'], 812),
('britmus',  'British Museum',            null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['london'], 813),
('stpauls',  'St Paul''s Cathedral',       null, '#FFFFFF', '#5C1F00', 'sights',      array['custom']::destination[], array['london'], 814),
('covgard',  'Covent Garden',             null, '#C9A961', '#5C1F00', 'sights',      array['custom']::destination[], array['london'], 815),
('lonwe',    'London West End Show',      null, '#7B2D8E', '#FFD700', 'activities',  array['custom']::destination[], array['london'], 816),
('tslond',   'Shrek''s Adventure',        null, '#2D5016', '#FFD700', 'attractions', array['custom']::destination[], array['london'], 817),
('lonzoo',   'ZSL London Zoo',            null, '#556B2F', '#F5D76E', 'attractions', array['custom']::destination[], array['london'], 818),
('seawlon',  'SEA LIFE London',           null, '#006B9F', '#FFFFFF', 'seaworld',    array['custom']::destination[], array['london'], 819),
('madameT',  'Madame Tussauds',           null, '#FF1493', '#FFFFFF', 'attractions', array['custom']::destination[], array['london'], 820),
('dungeon',  'London Dungeon',            null, '#1A1A2E', '#8B0000', 'attractions', array['custom']::destination[], array['london'], 821),
('greenwc',  'Greenwich & Maritime Museum', null, '#003D82', '#FFD700', 'sights',    array['custom']::destination[], array['london'], 822),
('kensing',  'Kensington Palace & Gardens', null, '#8B0000', '#F5D76E', 'sights',    array['custom']::destination[], array['london'], 823),
('hydepk',   'Hyde Park',                 null, '#2D5016', '#F5E6A8', 'sights',      array['custom']::destination[], array['london'], 824),
('borough',  'Borough Market',            null, '#C9A961', '#5C1F00', 'dining',      array['custom']::destination[], array['london'], 825),
('camdenm',  'Camden Market',             null, '#FF1493', '#FFD700', 'sights',      array['custom']::destination[], array['london'], 826),
('platf934', 'Platform 9¾ (Kings Cross)', null, '#1A1A2E', '#FFD700', 'sights',      array['custom']::destination[], array['london'], 827);
;
