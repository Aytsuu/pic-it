-- Enable pgvector
create extension if not exists vector with schema extensions;

-- Add 512-dim embedding column to photos
alter table photos add column if not exists embedding vector(512);

-- IVFFLAT index for cosine similarity
-- Use lists=10 locally (dev); bump to 100 for production (needs 100+ rows)
create index if not exists photos_embedding_idx
  on photos using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- RPC: search_photos
-- Called by the client with a text embedding; returns ranked results visible to the caller.
-- security definer so it can join members without additional RLS complications.
create or replace function search_photos(
  query_embedding vector(512),
  match_threshold float default 0.2,
  match_count     int   default 20,
  p_moment_id     uuid  default null
)
returns table(id uuid, moment_id uuid, storage_path text, similarity float)
language sql stable security definer
as $$
  select p.id,
         p.moment_id,
         p.storage_path,
         1 - (p.embedding <=> query_embedding) as similarity
  from   photos p
  where  p.embedding is not null
    and  (p_moment_id is null or p.moment_id = p_moment_id)
    and  1 - (p.embedding <=> query_embedding) > match_threshold
    and  exists (
           select 1 from members m
           where  m.moment_id = p.moment_id
             and  m.user_id = auth.uid()
         )
  order  by p.embedding <=> query_embedding
  limit  match_count;
$$;
