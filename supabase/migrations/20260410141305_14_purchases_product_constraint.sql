
-- Constrain purchases.product to known SKUs
-- Catches webhook bugs early instead of letting bad data accumulate
alter table purchases
  add constraint purchases_product_check
  check (product in ('pro', 'family', 'premium', 'concierge'));

-- Add Payhip product ID lookup table so webhook can map URL → tier reliably
create table payhip_products (
  payhip_id text primary key,           -- e.g. 'h9HnI'
  product text not null,                -- e.g. 'pro'
  price_gbp_pence int not null,         -- e.g. 2499
  display_name text not null,
  active boolean default true,
  created_at timestamptz default now()
);

insert into payhip_products (payhip_id, product, price_gbp_pence, display_name) values
  ('h9HnI', 'pro',     2499, 'TripTiles Pro — Visual Holiday Planner'),
  ('9dxKB', 'family',  4999, 'TripTiles Family — Plan Together'),
  ('76jPY', 'premium', 4900, 'TripTiles Premium — Enhanced AI Planning');

-- Make it readable to authenticated users (no sensitive data, just product metadata)
alter table payhip_products enable row level security;
create policy "Anyone can read active products"
  on payhip_products for select
  using (active = true);
;
