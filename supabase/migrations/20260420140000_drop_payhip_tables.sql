-- Drop legacy Payhip tables. Payhip integration was replaced by Stripe.
-- These tables have zero rows in production.
DROP TABLE IF EXISTS payhip_webhook_events;
DROP TABLE IF EXISTS payhip_products;
