-- Session 13: trip-level payment schedule (label, amounts in minor units, dates).
-- RLS: owner all + split collaborator policies (12A.1 pattern) + public read on published trips.

create table if not exists trip_payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  amount_pence integer not null check (amount_pence >= 0),
  currency text not null default 'GBP' check (currency in ('GBP', 'USD')),
  booking_date date,
  due_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_trip_payments_trip_id on trip_payments (trip_id);

drop trigger if exists trip_payments_updated_at on trip_payments;
create trigger trip_payments_updated_at
  before update on trip_payments
  for each row execute function update_updated_at();

alter table trip_payments enable row level security;

drop policy if exists trip_payments_owner_all on trip_payments;
create policy trip_payments_owner_all
  on trip_payments for all
  using (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  )
  with check (
    trip_id in (select id from trips where owner_id = (select auth.uid()))
  );

drop policy if exists trip_payments_collab_select on trip_payments;
create policy trip_payments_collab_select
  on trip_payments for select
  using (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_payments.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
    )
  );

drop policy if exists trip_payments_collab_insert on trip_payments;
create policy trip_payments_collab_insert
  on trip_payments for insert
  with check (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_payments.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
        and tc.role = 'editor'
    )
  );

drop policy if exists trip_payments_collab_update on trip_payments;
create policy trip_payments_collab_update
  on trip_payments for update
  using (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_payments.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
        and tc.role = 'editor'
    )
  )
  with check (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_payments.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
        and tc.role = 'editor'
    )
  );

drop policy if exists trip_payments_collab_delete on trip_payments;
create policy trip_payments_collab_delete
  on trip_payments for delete
  using (
    exists (
      select 1
      from trip_collaborators tc
      where
        tc.trip_id = trip_payments.trip_id
        and tc.user_id = (select auth.uid())
        and tc.status = 'accepted'
        and tc.role = 'editor'
    )
  );

drop policy if exists trip_payments_public_select on trip_payments;
create policy trip_payments_public_select
  on trip_payments for select
  using (
    trip_id in (select id from trips where is_public = true)
  );
