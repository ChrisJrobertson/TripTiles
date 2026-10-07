
-- The travel, dining, activities, and excursions groups should appear in
-- EVERY region. Update their region_ids arrays to include all 25 regions.

update parks
set region_ids = array[
  'orlando','cali','lasvegas','toronto','mexico',
  'paris','uk','germany','spain','netherlands','denmark','italy','belgium','sweden','finland',
  'tokyo','osaka','shanghai','hongkong','singapore','seoul',
  'uae','goldcoast','sydney','cruise','custom'
]
where park_group in ('travel', 'dining', 'activities', 'excursions');
;
