import * as SQLite from 'expo-sqlite';

export const db = SQLite.openDatabaseSync('pickit.db');

db.execSync(`
  create table if not exists unsynced_photos (
    local_id    text primary key,
    moment_id   text not null,
    local_uri   text not null,
    created_at  integer not null,
    sync_status text not null default 'pending',
    remote_id   text,
    attempts    integer not null default 0
  );

  create table if not exists cached_moments (
    user_id     text not null,
    moment_id   text not null,
    name        text not null,
    created_at  text not null,
    cached_at   integer not null,
    primary key (user_id, moment_id)
  );

  create table if not exists cached_photos (
    id            text primary key,
    moment_id     text not null,
    storage_path  text not null,
    created_at    text not null,
    cached_at     integer not null
  );

  create table if not exists photo_files (
    photo_id    text primary key,
    moment_id   text not null,
    local_uri   text not null,
    cached_at   integer not null
  );

  create table if not exists cached_picks (
    user_id     text not null,
    photo_id    text not null,
    moment_id   text not null,
    cached_at   integer not null,
    primary key (user_id, photo_id)
  );

  create table if not exists pending_picks (
    user_id     text not null,
    photo_id    text not null,
    moment_id   text not null,
    created_at  integer not null,
    primary key (user_id, photo_id)
  );

  create table if not exists photo_embeddings (
    photo_id   text primary key,
    embedding  blob not null,
    dim        integer not null default 512,
    synced     integer not null default 0,
    created_at integer not null
  );

  create table if not exists moment_cover_photos (
    user_id     text not null,
    moment_id   text not null,
    photo_id    text not null,
    updated_at  integer not null,
    primary key (user_id, moment_id)
  );
`);
