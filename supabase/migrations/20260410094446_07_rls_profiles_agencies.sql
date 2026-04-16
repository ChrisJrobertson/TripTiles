
alter table profiles enable row level security;
alter table agencies enable row level security;

create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Agency admins can view profiles in their agency"
  on profiles for select using (
    agency_id in (
      select p.agency_id from profiles p
      where p.id = auth.uid() and p.tier = 'agent_admin'
    )
  );

create policy "Agency members can view their agency"
  on agencies for select using (
    id in (select agency_id from profiles where id = auth.uid())
  );

create policy "Agency admins can update their agency"
  on agencies for update using (
    id in (
      select agency_id from profiles
      where id = auth.uid() and tier = 'agent_admin'
    )
  );
;
