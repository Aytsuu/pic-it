create table moments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  host_id     uuid not null references auth.users(id),
  code        text not null unique,
  created_at  timestamptz default now()
);

create table members (
  moment_id   uuid not null references moments(id),
  user_id     uuid not null references auth.users(id),
  primary key (moment_id, user_id)
);
