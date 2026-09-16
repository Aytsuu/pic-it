-- Ensure the moment-photos bucket exists (idempotent for fresh and existing DBs).
insert into storage.buckets (id, name, public)
values ('moment-photos', 'moment-photos', true)
on conflict (id) do update set public = excluded.public;

-- Public read for synced roll thumbnails.
drop policy if exists "Public read moment photos" on storage.objects;
create policy "Public read moment photos"
on storage.objects for select
to public
using (bucket_id = 'moment-photos');

-- Authenticated members can upload photos to the bucket.
drop policy if exists "Authenticated upload moment photos" on storage.objects;
create policy "Authenticated upload moment photos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'moment-photos');
