import AsyncStorage from '@react-native-async-storage/async-storage';

import { embedImage } from '@/lib/embedder';
import { getEmbedding, saveEmbedding } from '@/lib/embedding-store';
import { isOnnxRuntimeAvailable } from '@/lib/native-capabilities';
import { logSearchError, logSearchStep } from '@/lib/search-errors';
import { db } from '@/lib/db';

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

    const photos = db.getAllSync<{ photo_id: string; local_uri: string }>(
      `select photo_id, local_uri from photo_files where moment_id = ?`,
      [momentId]
    );

    logSearchStep('backfill:start', { momentId, photoCount: photos.length });

    for (const photo of photos) {
      if (getEmbedding(photo.photo_id)) continue;

      try {
        const vec = await embedImage(photo.local_uri);
        saveEmbedding(photo.photo_id, vec);
        logSearchStep('backfill:saved', { photoId: photo.photo_id });
      } catch (err) {
        logSearchError(`backfill:${photo.photo_id}`, err);
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
