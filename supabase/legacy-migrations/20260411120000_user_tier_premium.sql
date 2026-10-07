-- Payhip "TripTiles Premium" maps to tier `premium` (webhook handler).
ALTER TYPE public.user_tier ADD VALUE IF NOT EXISTS 'premium';
