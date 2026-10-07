-- Production drift: code inserts trips.gallery_owner_label but the older migration never ran in production.
-- Add the column idempotently so trip creation, cloning, and publish flows stop failing.

alter table public.trips
  add column if not exists gallery_owner_label text;

comment on column public.trips.gallery_owner_label is
  'Display label for the trip owner shown in the public gallery (e.g. "The Smith Family"). Null while unpublished.';
