
-- Global theme parks: Australia, Canada, Mexico, Italy, Belgium, Denmark, Sweden, Finland, Las Vegas, Toronto, Sydney, Osaka

insert into parks (id, name, icon, bg_colour, fg_colour, park_group, destinations, region_ids, sort_order) values

-- Australia Gold Coast
('mwau',     'Movie World Gold Coast', null, '#003D82', '#FFD700', 'universal',   array['custom']::destination[], array['goldcoast'],   410),
('seaau',    'Sea World Gold Coast',   null, '#006B9F', '#FFFFFF', 'seaworld',    array['custom']::destination[], array['goldcoast'],   411),
('dream',    'Dreamworld',             null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['goldcoast'],   412),
('wnwlau',   'Wet''n''Wild Gold Coast', null, '#00A8B5', '#FFFFFF', 'disneyextra', array['custom']::destination[], array['goldcoast'],  413),
('whitbeach','Whitewater World',       null, '#4A90D9', '#FFFFFF', 'disneyextra', array['custom']::destination[], array['goldcoast'],   414),
('auzoo',    'Australia Zoo',          null, '#556B2F', '#F5D76E', 'attractions', array['custom']::destination[], array['goldcoast'],   415),
('surf',     'Surfers Paradise Beach', null, '#FFA500', '#0B1E5C', 'sights',      array['custom']::destination[], array['goldcoast'],   416),

-- Sydney
('luna',     'Luna Park Sydney',       null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['sydney'],      430),
('sydoper',  'Sydney Opera House',     null, '#C9A961', '#0B1E5C', 'sights',      array['custom']::destination[], array['sydney'],      431),
('tarong',   'Taronga Zoo',            null, '#556B2F', '#F5D76E', 'attractions', array['custom']::destination[], array['sydney'],      432),
('bondi',    'Bondi Beach',            null, '#FFA500', '#0B1E5C', 'sights',      array['custom']::destination[], array['sydney'],      433),

-- Toronto
('cwond',    'Canada''s Wonderland',   null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['toronto'],     450),
('cnt',      'CN Tower',               null, '#1A1A2E', '#FFD700', 'sights',      array['custom']::destination[], array['toronto'],     451),
('rom',      'Royal Ontario Museum',   null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['toronto'],     452),
('niag',     'Niagara Falls',          null, '#1E6091', '#FFFFFF', 'sights',      array['custom']::destination[], array['toronto'],     453),

-- Mexico
('sfmex',    'Six Flags México',       null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['mexico'],      470),
('xcaret',   'Xcaret',                 null, '#00695C', '#FFFFFF', 'attractions', array['custom']::destination[], array['mexico'],      471),
('xelha',    'Xel-Há',                 null, '#00A8B5', '#FFFFFF', 'attractions', array['custom']::destination[], array['mexico'],      472),
('xplor',    'Xplor',                  null, '#556B2F', '#F5D76E', 'attractions', array['custom']::destination[], array['mexico'],      473),
('cancsigh', 'Cancún Sights',          null, '#FFA500', '#0B1E5C', 'sights',      array['custom']::destination[], array['mexico'],      474),
('mayar',    'Mayan Ruins',            null, '#8B6914', '#FFFFFF', 'sights',      array['custom']::destination[], array['mexico'],      475),

-- Italy
('garda',    'Gardaland',              null, '#1E88E5', '#FFFFFF', 'attractions', array['custom']::destination[], array['italy'],       490),
('mirab',    'Mirabilandia',           null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['italy'],       491),
('rainb',    'Rainbow MagicLand',      null, '#FF69B4', '#FFFFFF', 'attractions', array['custom']::destination[], array['italy'],       492),
('cine',     'Cinecittà World',        null, '#8B0000', '#F5D76E', 'attractions', array['custom']::destination[], array['italy'],       493),
('rome',     'Rome Sights',            null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['italy'],       494),
('venice',   'Venice',                 null, '#1E6091', '#FFFFFF', 'sights',      array['custom']::destination[], array['italy'],       495),

-- Belgium
('walbel',   'Walibi Belgium',         null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['belgium'],     510),
('plops',    'Plopsaland',             null, '#FF69B4', '#FFFFFF', 'attractions', array['custom']::destination[], array['belgium'],     511),
('bobbe',    'Bobbejaanland',          null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['belgium'],     512),
('brus',     'Brussels Sights',        null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['belgium'],     513),

-- Denmark
('tivoli',   'Tivoli Gardens',         null, '#E63946', '#FFD700', 'attractions', array['custom']::destination[], array['denmark'],     530),
('legobill', 'LEGOLAND Billund',       null, '#D7222C', '#FFD700', 'attractions', array['custom']::destination[], array['denmark'],     531),
('djurs',    'Djurs Sommerland',       null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['denmark'],     532),
('cph',      'Copenhagen Sights',      null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['denmark'],     533),

-- Sweden
('lise',     'Liseberg',               null, '#1E6091', '#FFD700', 'attractions', array['custom']::destination[], array['sweden'],      550),
('grona',    'Gröna Lund',             null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['sweden'],      551),
('stock',    'Stockholm Sights',       null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['sweden'],      552),

-- Finland
('linn',     'Linnanmäki',             null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['finland'],     570),
('puuh',     'PowerPark',              null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['finland'],     571),
('hels',     'Helsinki Sights',        null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['finland'],     572),

-- Las Vegas
('advdome',  'Adventuredome',          null, '#FF1493', '#FFD700', 'attractions', array['custom']::destination[], array['lasvegas'],    590),
('lvstrip',  'Las Vegas Strip',        null, '#FFD700', '#0B1E5C', 'sights',      array['custom']::destination[], array['lasvegas'],    591),
('grandcyn', 'Grand Canyon Day Trip',  null, '#8B6914', '#FFFFFF', 'sights',      array['custom']::destination[], array['lasvegas'],    592),

-- Osaka (separate from Tokyo)
('usj2',     'USJ Osaka',              null, '#003D82', '#FFD700', 'universal',   array['custom']::destination[], array['osaka'],       610),
('osakae',   'Osaka Castle',           null, '#8B0000', '#F5D76E', 'sights',      array['custom']::destination[], array['osaka'],       611),
('umeda',    'Umeda Sky Building',     null, '#1A1A2E', '#FFD700', 'sights',      array['custom']::destination[], array['osaka'],       612),
('kyoto',    'Kyoto Day Trip',         null, '#8B0000', '#F5D76E', 'sights',      array['custom']::destination[], array['osaka'],       613);
;
