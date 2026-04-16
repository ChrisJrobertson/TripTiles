
alter table trips enable row level security;
alter table trip_collaborators enable row level security;

create policy "Users can view their own trips"
  on trips for select using (owner_id = auth.uid());

create policy "Collaborators can view shared trips"
  on trips for select using (
    id in (
      select trip_id from trip_collaborators
      where user_id = auth.uid() and status = 'accepted'
    )
  );

create policy "Agency members can view agency trips"
  on trips for select using (
    agency_id is not null and
    agency_id in (select agency_id from profiles where id = auth.uid())
  );

create policy "Anyone can view public trips"
  on trips for select using (is_public = true);

create policy "Users can insert their own trips"
  on trips for insert with check (owner_id = auth.uid());

create policy "Users can update their own trips"
  on trips for update using (owner_id = auth.uid());

create policy "Editor collaborators can update shared trips"
  on trips for update using (
    id in (
      select trip_id from trip_collaborators
      where user_id = auth.uid() and status = 'accepted' and role = 'editor'
    )
  );

create policy "Users can delete their own trips"
  on trips for delete using (owner_id = auth.uid());

create policy "Users can see collaborators on their own trips"
  on trip_collaborators for select using (
    trip_id in (select id from trips where owner_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "Trip owners can add collaborators"
  on trip_collaborators for insert with check (
    trip_id in (select id from trips where owner_id = auth.uid())
  );

create policy "Trip owners can remove collaborators"
  on trip_collaborators for delete using (
    trip_id in (select id from trips where owner_id = auth.uid())
  );
;
