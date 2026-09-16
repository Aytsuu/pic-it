import * as queue from '@/lib/queue';
import { isOnline } from '@/lib/network';
import {
  clearPendingPicks,
  getAllPendingPickRows,
  remapPickPhotoId,
} from '@/lib/picks-cache';
import { registerPhotoFile } from '@/lib/photo-cache';
import { supabase } from '@/lib/supabase';
import { uploadPhoto } from '@/lib/storage';

const inFlightMomentSyncs = new Map<string, Promise<void>>();

export async function scheduleSync(userId: string, momentId?: string): Promise<void> {
  if (!(await isOnline())) return;

  if (momentId) {
    await syncMoment(momentId, userId);
    return;
  }

  await syncAllPending(userId);
}

export async function syncMoment(momentId: string, userId: string): Promise<void> {
  const existing = inFlightMomentSyncs.get(momentId);
  if (existing) {
    await existing;
    return;
  }

  const run = syncMomentInternal(momentId, userId).finally(() => {
    inFlightMomentSyncs.delete(momentId);
  });

  inFlightMomentSyncs.set(momentId, run);
  await run;
}

async function syncMomentInternal(momentId: string, userId: string): Promise<void> {
  const pending = queue.getPending(momentId);

  for (const photo of pending) {
    if (!queue.tryClaimForSync(photo.local_id)) continue;

    try {
      const storagePath = await uploadPhoto(momentId, photo.local_uri);

      const { data, error } = await supabase
        .from('photos')
        .insert({
          moment_id: momentId,
          uploaded_by: userId,
          storage_path: storagePath,
          created_at: new Date(photo.created_at).toISOString(),
        })
        .select('id')
        .single();

      if (error || !data) throw error ?? new Error('Insert failed');

      queue.markSynced(photo.local_id, data.id);
      registerPhotoFile(data.id, momentId, photo.local_uri);
      remapPickPhotoId(userId, photo.local_id, data.id);
    } catch {
      queue.markFailed(photo.local_id);
    }
  }
}

function resolveRemotePhotoId(photoId: string): string | null {
  const remoteFromLocal = queue.getRemoteId(photoId);
  if (remoteFromLocal) return remoteFromLocal;

  if (queue.isUnsyncedLocalId(photoId)) return null;

  return photoId;
}

export async function syncPendingPicks(userId: string): Promise<void> {
  if (!(await isOnline())) return;

  const pending = getAllPendingPickRows(userId);
  if (pending.length === 0) return;

  const resolved = pending
    .map((pick) => ({
      originalId: pick.photo_id,
      remoteId: resolveRemotePhotoId(pick.photo_id),
    }))
    .filter((pick): pick is { originalId: string; remoteId: string } => pick.remoteId !== null);

  if (resolved.length === 0) return;

  const rows = resolved.map((pick) => ({
    user_id: userId,
    photo_id: pick.remoteId,
  }));

  const { error } = await supabase.from('picks').upsert(rows, {
    onConflict: 'user_id,photo_id',
  });

  if (error) return;

  for (const pick of resolved) {
    if (pick.originalId !== pick.remoteId) {
      remapPickPhotoId(userId, pick.originalId, pick.remoteId);
    }
  }

  clearPendingPicks(
    userId,
    resolved.map((pick) => pick.originalId)
  );
}

export async function syncAllPending(userId: string): Promise<void> {
  const { db } = await import('@/lib/db');
  const momentIds = db.getAllSync<{ moment_id: string }>(
    `select distinct moment_id from unsynced_photos where sync_status = 'pending'`
  );

  for (const row of momentIds) {
    await syncMoment(row.moment_id, userId);
  }

  await syncPendingPicks(userId);
}
