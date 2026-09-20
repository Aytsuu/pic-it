-- Owner-only delete for photos; members can read photos in their moments.

alter table picks
  drop constraint if exists picks_photo_id_fkey;

alter table picks
  add constraint picks_photo_id_fkey
  foreign key (photo_id) references photos(id) on delete cascade;

alter table photos enable row level security;

grant select, insert, delete on photos to authenticated;

drop policy if exists "Members can view moment photos" on photos;
create policy "Members can view moment photos"
on photos for select
to authenticated
using (
  exists (
    select 1 from members
    where members.moment_id = photos.moment_id
      and members.user_id = auth.uid()
  )
);

drop policy if exists "Members can insert own photos" on photos;
create policy "Members can insert own photos"
on photos for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1 from members
    where members.moment_id = photos.moment_id
      and members.user_id = auth.uid()
  )
);

drop policy if exists "Uploaders can delete own photos" on photos;
create policy "Uploaders can delete own photos"
on photos for delete
to authenticated
using (uploaded_by = auth.uid());

-- Delete bucket objects before the photos row is removed (client order matters).
drop policy if exists "Uploaders can delete own moment photos" on storage.objects;
create policy "Uploaders can delete own moment photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'moment-photos'
  and exists (
    select 1 from photos
    where photos.storage_path = storage.objects.name
      and photos.uploaded_by = auth.uid()
  )
);
