import { db } from '@/lib/db';

const DIM = 512;

function float32ToBytes(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer.slice(vec.byteOffset, vec.byteOffset + vec.byteLength));
}

function bytesToFloat32(bytes: Uint8Array): Float32Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}

export function saveEmbedding(photoId: string, vec: Float32Array): void {
  db.runSync(
    `insert or replace into photo_embeddings (photo_id, embedding, dim, synced, created_at)
     values (?, ?, ?, 0, ?)`,
    [photoId, float32ToBytes(vec), DIM, Date.now()]
  );
}

export function getEmbedding(photoId: string): Float32Array | null {
  const row = db.getFirstSync<{ embedding: Uint8Array }>(
    `select embedding from photo_embeddings where photo_id = ?`,
    [photoId]
  );
  if (!row) return null;
  return bytesToFloat32(row.embedding);
}

export function listUnsynced(): { photoId: string; embedding: Float32Array }[] {
  const rows = db.getAllSync<{ photo_id: string; embedding: Uint8Array }>(
    `select photo_id, embedding from photo_embeddings where synced = 0`
  );

  return rows.map((row) => ({
    photoId: row.photo_id,
    embedding: bytesToFloat32(row.embedding),
  }));
}

export function markSyncedEmbeddings(photoIds: string[]): void {
  if (photoIds.length === 0) return;

  const placeholders = photoIds.map(() => '?').join(',');
  db.runSync(
    `update photo_embeddings set synced = 1 where photo_id in (${placeholders})`,
    photoIds
  );
}

export function deleteEmbedding(photoId: string): void {
  db.runSync(`delete from photo_embeddings where photo_id = ?`, [photoId]);
}

export function getAllEmbeddings(
  momentId?: string
): { photoId: string; embedding: Float32Array }[] {
  if (momentId) {
    const rows = db.getAllSync<{ photo_id: string; embedding: Uint8Array }>(
      `select pe.photo_id, pe.embedding
       from photo_embeddings pe
       inner join photo_files pf on pf.photo_id = pe.photo_id
       where pf.moment_id = ?`,
      [momentId]
    );

    return rows.map((row) => ({
      photoId: row.photo_id,
      embedding: bytesToFloat32(row.embedding),
    }));
  }

  const rows = db.getAllSync<{ photo_id: string; embedding: Uint8Array }>(
    `select photo_id, embedding from photo_embeddings`
  );

  return rows.map((row) => ({
    photoId: row.photo_id,
    embedding: bytesToFloat32(row.embedding),
  }));
}
