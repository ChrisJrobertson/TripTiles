
-- Global theme parks: UK, Germany, Spain, Netherlands

insert into parks (id, name, icon, bg_colour, fg_colour, park_group, destinations, region_ids, sort_order) values

-- ============================================================================
-- UK 🇬🇧
-- ============================================================================
('alton',    'Alton Towers',           null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['uk'],          200),
('thorpe',   'Thorpe Park',            null, '#003D82', '#FFD700', 'attractions', array['custom']::destination[], array['uk'],          201),
('legoukw',  'LEGOLAND Windsor',       null, '#D7222C', '#FFD700', 'attractions', array['custom']::destination[], array['uk'],          202),
('chess',    'Chessington',            null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['uk'],          203),
('paultons', 'Paultons (Peppa Pig)',   null, '#FF69B4', '#FFFFFF', 'attractions', array['custom']::destination[], array['uk'],          204),
('drayton',  'Drayton Manor',          null, '#8B4513', '#FFD700', 'attractions', array['custom']::destination[], array['uk'],          205),
('bppb',     'Blackpool Pleasure Beach', null, '#E63946', '#FFFFFF', 'attractions', array['custom']::destination[], array['uk'],        206),
('flam',     'Flamingo Land',          null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['uk'],          207),
('lon',      'London Sights',          null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['uk'],          208),
('lonw',     'London West End',        null, '#7B2D8E', '#FFFFFF', 'sights',      array['custom']::destination[], array['uk'],          209),
('warner',   'Harry Potter Studio Tour', null, '#1A1A2E', '#FFD700', 'attractions', array['custom']::destination[], array['uk'],        210),

-- ============================================================================
-- Germany 🇩🇪
-- ============================================================================
('europa',   'Europa-Park',            null, '#003D82', '#FFD700', 'attractions', array['custom']::destination[], array['germany'],     220),
('phant',    'Phantasialand',          null, '#6A0DAD', '#F5D76E', 'attractions', array['custom']::destination[], array['germany'],     221),
('legodeu',  'LEGOLAND Deutschland',   null, '#D7222C', '#FFD700', 'attractions', array['custom']::destination[], array['germany'],     222),
('heide',    'Heide Park',             null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['germany'],     223),
('movie',    'Movie Park Germany',     null, '#8B0000', '#F5D76E', 'attractions', array['custom']::destination[], array['germany'],     224),
('hansa',    'Hansa-Park',             null, '#1E6091', '#FFD700', 'attractions', array['custom']::destination[], array['germany'],     225),
('berlin',   'Berlin Sights',          null, '#5C1F00', '#F5D76E', 'sights',      array['custom']::destination[], array['germany'],     226),
('munich',   'Munich Sights',          null, '#1E88E5', '#FFFFFF', 'sights',      array['custom']::destination[], array['germany'],     227),

-- ============================================================================
-- Spain 🇪🇸 (Costa Daurada / PortAventura)
-- ============================================================================
('porta',    'PortAventura World',     null, '#C2410C', '#FFF4C2', 'attractions', array['custom']::destination[], array['spain'],       240),
('ferrar',   'Ferrari Land',           null, '#E63946', '#FFD700', 'attractions', array['custom']::destination[], array['spain'],       241),
('caribe',   'Caribe Aquatic Park',    null, '#00A8B5', '#FFFFFF', 'attractions', array['custom']::destination[], array['spain'],       242),
('warnes',   'Parque Warner Madrid',   null, '#003D82', '#FFD700', 'attractions', array['custom']::destination[], array['spain'],       243),
('isla',     'Isla Mágica (Sevilla)',  null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['spain'],       244),
('barc',     'Barcelona Sights',       null, '#C9A961', '#0B1E5C', 'sights',      array['custom']::destination[], array['spain'],       245),
('mad',      'Madrid Sights',          null, '#C71585', '#FFFFFF', 'sights',      array['custom']::destination[], array['spain'],       246),
('costa',    'Beach Day (Costa)',      null, '#FFA500', '#0B1E5C', 'sights',      array['custom']::destination[], array['spain'],       247),

-- ============================================================================
-- Netherlands 🇳🇱
-- ============================================================================
('eft',      'Efteling',               null, '#2D5016', '#F5E6A8', 'attractions', array['custom']::destination[], array['netherlands'], 260),
('walib',    'Walibi Holland',         null, '#FFA500', '#0B1E5C', 'attractions', array['custom']::destination[], array['netherlands'], 261),
('duin',     'Duinrell',               null, '#1E6091', '#FFFFFF', 'attractions', array['custom']::destination[], array['netherlands'], 262),
('ams',      'Amsterdam Sights',       null, '#C71585', '#FFFFFF', 'sights',      array['custom']::destination[], array['netherlands'], 263);
;
