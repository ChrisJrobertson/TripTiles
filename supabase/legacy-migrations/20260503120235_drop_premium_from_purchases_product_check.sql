alter table purchases drop constraint if exists purchases_product_check;

alter table purchases
  add constraint purchases_product_check
  check (product = any (array['pro'::text, 'family'::text, 'concierge'::text]));
