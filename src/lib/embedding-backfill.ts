import AsyncStorage from '@react-native-async-storage/async-storage';

import { embedImage } from '@/lib/embedder';
import { getEmbedding, saveEmbedding } from '@/lib/embedding-store';
import { isVideoUri } from '@/lib/media-uri';
import { isOnnxRuntimeAvailable } from '@/lib/native-capabilities';
import { resolveLocalPhotoUriForEmbedding } from '@/lib/photo-cache';
import { logSearchError, logSearchStep } from '@/lib/search-errors';
import { db } from '@/lib/db';

type BackfillPhoto = {
  photoId: string;
  localUri: string | null;
  storagePath: string | null;
};

function listPhotosForEmbedding(momentId: string): BackfillPhoto[] {
  const byId = new Map<string, BackfillPhoto>();

  const cached = db.getAllSync<{ id: string; storage_path: string }>(
    `select id, storage_path from cached_photos where moment_id = ?`,
    [momentId]
  );
  for (const row of cached) {
    byId.set(row.id, {
      photoId: row.id,
      localUri: null,
      storagePath: row.storage_path,
    });
  }

  const files = db.getAllSync<{ photo_id: string; local_uri: string }>(
    `select photo_id, local_uri from photo_files where moment_id = ?`,
    [momentId]
  );
  for (const row of files) {
    const existing = byId.get(row.photo_id);
    byId.set(row.photo_id, {
      photoId: row.photo_id,
      localUri: row.local_uri,
      storagePath: existing?.storagePath ?? null,
    });
  }

  const queued = db.getAllSync<{ local_id: string; local_uri: string }>(
    `select local_id, local_uri
     from unsynced_photos
     where moment_id = ? and remote_id is null`,
    [momentId]
  );
  for (const row of queued) {
    if (byId.has(row.local_id)) continue;
    byId.set(row.local_id, {
      photoId: row.local_id,
      localUri: row.local_uri,
      storagePath: null,
    });
  }

  return [...byId.values()];
}

const EMBEDDING_INDEX_VERSION_KEY = 'photo_embeddings_index_v';
const CURRENT_EMBEDDING_INDEX_VERSION = '2';

let backfillInFlight: Promise<void> | null = null;

async function ensureEmbeddingIndexVersion(): Promise<void> {
  const version = await AsyncStorage.getItem(EMBEDDING_INDEX_VERSION_KEY);
  if (version === CURRENT_EMBEDDING_INDEX_VERSION) return;

  db.runSync(`delete from photo_embeddings`);
  await AsyncStorage.setItem(EMBEDDING_INDEX_VERSION_KEY, CURRENT_EMBEDDING_INDEX_VERSION);
  logSearchStep('backfill:reindex', { reason: 'embedding_index_version_bump' });
}

export async function backfillEmbeddingsForMoment(momentId: string): Promise<void> {
  if (!isOnnxRuntimeAvailable()) return;

  if (backfillInFlight) {
    await backfillInFlight;
    return;
  }

  backfillInFlight = (async () => {
    await ensureEmbeddingIndexVersion();

    const photos = listPhotosForEmbedding(momentId);

    logSearchStep('backfill:start', { momentId, photoCount: photos.length });

    for (const photo of photos) {
      if (getEmbedding(photo.photoId)) continue;

      const uriHint = photo.localUri ?? photo.storagePath ?? '';
      if (uriHint && isVideoUri(uriHint)) {
        logSearchStep('backfill:skip', { photoId: photo.photoId, reason: 'video' });
        continue;
      }

      const localUri = await resolveLocalPhotoUriForEmbedding(photo.photoId, momentId, {
        localUri: photo.localUri,
        storagePath: photo.storagePath,
      });

      if (!localUri) {
        logSearchStep('backfill:skip', { photoId: photo.photoId, reason: 'no_local_file' });
        continue;
      }

      try {
        const vec = await embedImage(localUri);
        saveEmbedding(photo.photoId, vec);
        logSearchStep('backfill:saved', { photoId: photo.photoId });
      } catch (err) {
        logSearchError(`backfill:${photo.photoId}`, err);
      }
    }

    logSearchStep('backfill:done', { momentId });
  })().finally(() => {
    backfillInFlight = null;
  });

  await backfillInFlight;
}

export function countLocalEmbeddings(momentId?: string): number {
  if (momentId) {
    const row = db.getFirstSync<{ count: number }>(
      `select count(*) as count
       from photo_embeddings pe
       inner join photo_files pf on pf.photo_id = pe.photo_id
       where pf.moment_id = ?`,
      [momentId]
    );
    return row?.count ?? 0;
  }

  const row = db.getFirstSync<{ count: number }>(
    `select count(*) as count from photo_embeddings`
  );
  return row?.count ?? 0;
}
