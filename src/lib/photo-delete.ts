import { isOnline } from '@/lib/network';
import { purgePhotoFromDevice } from '@/lib/photo-cache';
import { removePicksForPhoto } from '@/lib/picks-cache';
import {
  getByLocalId,
  getByRemoteId,
  isUnsyncedLocalId,
  remove as removeQueuedPhoto,
  removeByRemoteId,
} from '@/lib/queue';
import { deletePhotoFromStorage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type DeletePhotoResult = { ok: true } | { ok: false; error: string };

async function deleteRemotePhotoRecord(photoId: string, storagePath: string): Promise<void> {
  // Storage RLS checks the photos row still exists — remove the bucket object first.
  await deletePhotoFromStorage(storagePath);

  const { error } = await supabase.from('photos').delete().eq('id', photoId);
  if (error) throw error;
}

function collectLocalPhotoIds(photoId: string, remoteId?: string | null): string[] {
  const ids = [photoId];
  if (remoteId) ids.push(remoteId);

  const linked = getByRemoteId(photoId);
  if (linked) ids.push(linked.local_id);

  return [...new Set(ids)];
}

export async function deletePhoto(
  userId: string,
  momentId: string,
  photoId: string,
  storagePath?: string
): Promise<DeletePhotoResult> {
  const queued = getByLocalId(photoId);

  if (queued || isUnsyncedLocalId(photoId)) {
    const localPhoto = queued ?? getByLocalId(photoId);
    if (!localPhoto) {
      return { ok: false, error: 'Photo not found on this device' };
    }

    const remoteId = localPhoto.remote_id;
    const path = storagePath ?? (remoteId ? await lookupStoragePath(remoteId) : null);

    if (remoteId && path) {
      if (!(await isOnline())) {
        return { ok: false, error: 'Photo was removed locally. Reconnect to delete it from the moment.' };
      }

      try {
        await deleteRemotePhotoRecord(remoteId, path);
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Could not delete photo from the moment',
        };
      }
    }

    removeQueuedPhoto(photoId);
    removePicksForPhoto(photoId);
    if (remoteId) {
      removePicksForPhoto(remoteId);
      removeByRemoteId(remoteId);
    }

    await purgePhotoFromDevice(momentId, collectLocalPhotoIds(photoId, remoteId));

    return { ok: true };
  }

  if (!(await isOnline())) {
    return { ok: false, error: 'Connect to the internet to delete this photo' };
  }

  const { data: photo, error: lookupError } = await supabase
    .from('photos')
    .select('id, uploaded_by, storage_path')
    .eq('id', photoId)
    .eq('moment_id', momentId)
    .single();

  if (lookupError || !photo) {
    return { ok: false, error: 'Photo not found' };
  }

  if (photo.uploaded_by !== userId) {
    return { ok: false, error: 'You can only delete photos you took' };
  }

  try {
    await deleteRemotePhotoRecord(photo.id, photo.storage_path);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not delete photo',
    };
  }

  removePicksForPhoto(photoId);
  removeByRemoteId(photoId);

  await purgePhotoFromDevice(momentId, collectLocalPhotoIds(photoId));

  return { ok: true };
}

async function lookupStoragePath(photoId: string): Promise<string | null> {
  const { data } = await supabase.from('photos').select('storage_path').eq('id', photoId).single();
  return data?.storage_path ?? null;
}
