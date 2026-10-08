import { db } from '@/lib/db';
import { embedText } from '@/lib/embedder';
import { getAllEmbeddings } from '@/lib/embedding-store';
import { isOnline } from '@/lib/network';
import { formatSearchError, logSearchError, logSearchStep } from '@/lib/search-errors';
import { supabase } from '@/lib/supabase';

export type SearchResult = {
  photoId: string;
  momentId: string;
  storagePath: string;
  similarity: number;
};

type RpcSearchRow = {
  id: string;
  moment_id: string;
  storage_path: string;
  similarity: number;
};

/** Quantized CLIP scores run lower than full-precision — keep this modest. */
const MIN_ABSOLUTE_SCORE = 0.2;

/** Top match must beat the gallery median by at least this much (larger galleries). */
const MIN_SPREAD_FROM_MEDIAN = 0.02;

/**
 * Keep every photo within this distance of the top score. Multiple relevant shots
 * (same subject, different angles) often cluster here instead of separating cleanly.
 */
const RELATIVE_BAND_FROM_TOP = 0.04;

/** Below this top score, a flat gallery is treated as "no real match". */
const WEAK_TOP_SCORE = 0.24;

const SMALL_GALLERY_MAX = 4;

const RESULT_LIMIT = 20;

function cosineSim(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Return all photos in a similarity band around the best match. Reject only when the
 * whole gallery clusters at noise level (vague query, no subject stands out).
 */
function filterByGallerySpread(
  scored: { photoId: string; similarity: number }[],
  limit: number
): { photoId: string; similarity: number }[] {
  if (scored.length === 0) return [];

  const sorted = [...scored].sort((a, b) => b.similarity - a.similarity);
  const scores = sorted.map((row) => row.similarity);
  const top = scores[0];
  const med = median(scores);
  const spread = top - med;

  logSearchStep('filter:scores', {
    top,
    median: med,
    spread,
    gallerySize: scores.length,
    sample: scores.slice(0, 5).map((s) => Math.round(s * 1000) / 1000),
  });

  if (top < MIN_ABSOLUTE_SCORE) {
    logSearchStep('filter:rejected', { reason: 'below_absolute_min', top });
    return [];
  }

  if (scores.length === 1) return sorted.slice(0, limit);

  const galleryLooksLikeNoise =
    spread < MIN_SPREAD_FROM_MEDIAN && top < WEAK_TOP_SCORE;

  if (scores.length <= SMALL_GALLERY_MAX) {
    if (galleryLooksLikeNoise) {
      logSearchStep('filter:rejected', {
        reason: 'small_gallery_noise',
        top,
        median: med,
        spread,
      });
      return [];
    }
  } else if (spread < MIN_SPREAD_FROM_MEDIAN) {
    logSearchStep('filter:rejected', { reason: 'low_spread', top, median: med, spread });
    return [];
  }

  const cutoff = Math.max(MIN_ABSOLUTE_SCORE, top - RELATIVE_BAND_FROM_TOP);
  const kept = sorted.filter((row) => row.similarity >= cutoff).slice(0, limit);

  logSearchStep('filter:kept', { mode: 'relative_band', cutoff, count: kept.length });
  return kept;
}

function resolveSearchResult(photoId: string, similarity: number): SearchResult | null {
  const cached = db.getFirstSync<{ moment_id: string; storage_path: string }>(
    `select moment_id, storage_path from cached_photos where id = ?`,
    [photoId]
  );
  if (cached) {
    return {
      photoId,
      momentId: cached.moment_id,
      storagePath: cached.storage_path,
      similarity,
    };
  }

  const file = db.getFirstSync<{ moment_id: string }>(
    `select moment_id from photo_files where photo_id = ?`,
    [photoId]
  );
  if (!file) return null;

  const remote = db.getFirstSync<{ storage_path: string }>(
    `select storage_path from cached_photos where id = ?`,
    [photoId]
  );

  if (!remote?.storage_path) return null;

  return {
    photoId,
    momentId: file.moment_id,
    storagePath: remote.storage_path,
    similarity,
  };
}

async function searchRemote(
  queryVec: Float32Array,
  opts: { momentId?: string; limit: number }
): Promise<SearchResult[] | null> {
  try {
    const { data, error } = await supabase.rpc('search_photos', {
      query_embedding: Array.from(queryVec),
      match_threshold: MIN_ABSOLUTE_SCORE,
      match_count: opts.limit,
      p_moment_id: opts.momentId ?? null,
    });

    if (error) {
      logSearchError('supabase rpc', error);
      return null;
    }

    logSearchStep('rpc:results', { count: data?.length ?? 0 });

    if (!data || data.length === 0) return [];

    return (data as RpcSearchRow[]).map((row) => ({
      photoId: row.id,
      momentId: row.moment_id,
      storagePath: row.storage_path,
      similarity: row.similarity,
    }));
  } catch (err) {
    logSearchError('supabase rpc throw', err);
    return null;
  }
}

function searchLocal(
  queryVec: Float32Array,
  opts: { momentId?: string; limit: number }
): SearchResult[] {
  const allEmbeddings = getAllEmbeddings(opts.momentId);
  logSearchStep('local:index', { embeddingCount: allEmbeddings.length, momentId: opts.momentId });

  const scored = allEmbeddings.map(({ photoId, embedding }) => ({
    photoId,
    similarity: cosineSim(queryVec, embedding),
  }));

  const filtered = filterByGallerySpread(scored, opts.limit);

  const results = filtered
    .map(({ photoId, similarity }) => resolveSearchResult(photoId, similarity))
    .filter((result): result is SearchResult => result !== null);

  logSearchStep('local:results', { count: results.length });
  return results;
}

export async function searchPhotos(
  query: string,
  opts?: { momentId?: string; limit?: number }
): Promise<SearchResult[]> {
  const limit = opts?.limit ?? RESULT_LIMIT;

  logSearchStep('search:start', { query, momentId: opts?.momentId });

  let queryVec: Float32Array;
  try {
    queryVec = await embedText(query);
    logSearchStep('embed:done', { dims: queryVec.length });
  } catch (err) {
    logSearchError('embed:text', err);
    throw new Error(`Text embedding failed: ${formatSearchError(err)}`);
  }

  const localEmbeddingCount = getAllEmbeddings(opts?.momentId).length;

  // Prefer local scoring — we see the full gallery distribution (needed for spread filter).
  if (localEmbeddingCount > 0) {
    return searchLocal(queryVec, { momentId: opts?.momentId, limit });
  }

  if (await isOnline()) {
    const remote = await searchRemote(queryVec, { momentId: opts?.momentId, limit });
    if (remote !== null) {
      const asScored = remote.map((row) => ({
        photoId: row.photoId,
        similarity: row.similarity,
      }));
      const filtered = filterByGallerySpread(asScored, limit);
      return filtered
        .map(({ photoId, similarity }) => {
          const match = remote.find((row) => row.photoId === photoId);
          return match ? { ...match, similarity } : null;
        })
        .filter((row): row is SearchResult => row !== null);
    }
  }

  return [];
}
