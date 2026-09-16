create table picks (
  user_id   uuid not null references auth.users(id),
  photo_id  uuid not null references photos(id),
  primary key (user_id, photo_id)
);
