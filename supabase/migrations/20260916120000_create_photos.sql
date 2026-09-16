create table photos (
  id            uuid primary key default gen_random_uuid(),
  moment_id     uuid not null references moments(id),
  uploaded_by   uuid not null references auth.users(id),
  storage_path  text not null,
  created_at    timestamptz default now()
);

insert into storage.buckets (id, name, public)
values ('moment-photos', 'moment-photos', true)
on conflict (id) do nothing;

alter publication supabase_realtime add table photos;
