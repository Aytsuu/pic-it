import * as queue from '@/lib/queue';
import { isOnline } from '@/lib/network';
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
    } catch {
      queue.markFailed(photo.local_id);
    }
  }
}

export async function syncAllPending(userId: string): Promise<void> {
  const { db } = await import('@/lib/db');
  const momentIds = db.getAllSync<{ moment_id: string }>(
    `select distinct moment_id from unsynced_photos where sync_status = 'pending'`
  );

  for (const row of momentIds) {
    await syncMoment(row.moment_id, userId);
  }
}
