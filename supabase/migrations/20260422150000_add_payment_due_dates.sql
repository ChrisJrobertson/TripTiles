-- trip_payments: paid_at + category (due_date already exists from 20260418120000_trip_payments.sql).
-- RLS unchanged — existing owner/collaborator policies apply to new columns.

alter table trip_payments
  add column if not exists paid_at timestamptz null;

alter table trip_payments
  add column if not exists category text null;

alter table trip_payments drop constraint if exists trip_payments_category_check;

alter table trip_payments
  add constraint trip_payments_category_check
  check (
    category is null
    or category in (
      'cruise',
      'villa',
      'hotel',
      'flights',
      'tickets',
      'insurance',
      'dining',
      'other'
    )
  );
