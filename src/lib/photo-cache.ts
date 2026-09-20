import { db } from '@/lib/db';
import { deleteCachedPhotoFile, deleteLocalFile, downloadPhotoToCache, fileExists } from '@/lib/photo-files';
import { removeCachedPhoto } from '@/lib/offline-cache';
import { Image } from 'expo-image';
import { isOnline } from '@/lib/network';
import { getByLocalId } from '@/lib/queue';

const BUCKET_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/moment-photos`;

type PhotoRef = {
  id: string;
  storage_path: string;
};

export function registerPhotoFile(photoId: string, momentId: string, localUri: string): void {
  db.runSync(
    `insert or replace into photo_files (photo_id, moment_id, local_uri, cached_at)
     values (?, ?, ?, ?)`,
    [photoId, momentId, localUri, Date.now()]
  );
}

export function removePhotoFile(photoId: string): void {
  db.runSync(`delete from photo_files where photo_id = ?`, [photoId]);
}

export async function purgePhotoFromDevice(momentId: string, photoIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(photoIds.filter(Boolean))];

  for (const photoId of uniqueIds) {
    const registeredUri = getPhotoLocalUri(photoId);
    if (registeredUri) {
      await deleteLocalFile(registeredUri);
    }

    await deleteCachedPhotoFile(momentId, photoId);
    removePhotoFile(photoId);
    removeCachedPhoto(momentId, photoId);
  }

  await Image.clearMemoryCache();
  await Image.clearDiskCache();
}

export function getPhotoLocalUri(photoId: string): string | null {
  const row = db.getFirstSync<{ local_uri: string }>(
    `select local_uri from photo_files where photo_id = ?`,
    [photoId]
  );
  return row?.local_uri ?? null;
}

export function getPhotoDisplayUri(photoId: string, storagePath: string): string {
  const localUri = getPhotoLocalUri(photoId);
  if (localUri) return localUri;
  return `${BUCKET_URL}/${storagePath}`;
}

export async function cacheRemotePhoto(
  photoId: string,
  momentId: string,
  storagePath: string
): Promise<string | null> {
  const existing = getPhotoLocalUri(photoId);
  if (existing && await fileExists(existing)) return existing;

  if (!(await isOnline())) return existing;

  try {
    const localUri = await downloadPhotoToCache(
      `${BUCKET_URL}/${storagePath}`,
      photoId,
      momentId
    );
    registerPhotoFile(photoId, momentId, localUri);
    return localUri;
  } catch {
    return existing;
  }
}

export async function cacheRemotePhotos(momentId: string, photos: PhotoRef[]): Promise<void> {
  for (const photo of photos) {
    await cacheRemotePhoto(photo.id, momentId, photo.storage_path);
  }
}

export async function resolvePhotoUri(
  photoId: string,
  momentId: string,
  storagePath?: string,
  knownLocalUri?: string
): Promise<string> {
  if (knownLocalUri && await fileExists(knownLocalUri)) return knownLocalUri;

  const unsynced = getByLocalId(photoId);
  if (unsynced?.local_uri && await fileExists(unsynced.local_uri)) {
    return unsynced.local_uri;
  }

  const cached = getPhotoLocalUri(photoId);
  if (cached && await fileExists(cached)) return cached;

  if (storagePath && (await isOnline())) {
    const downloaded = await cacheRemotePhoto(photoId, momentId, storagePath);
    if (downloaded && await fileExists(downloaded)) return downloaded;
  }

  if (cached) return cached;

  throw new Error('Photo file is not available on this device yet');
}
