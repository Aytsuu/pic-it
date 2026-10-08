import { db } from '@/lib/db';
import { deleteEmbedding } from '@/lib/embedding-store';
import { isVideoUri } from '@/lib/media-uri';
import {
  deleteCachedPhotoFile,
  deleteLocalFile,
  downloadPhotoToCache,
  fileExists,
  getCachedPhotoPath,
} from '@/lib/photo-files';
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
    deleteEmbedding(photoId);
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

  const queued = getByLocalId(photoId);
  if (queued?.local_uri) return queued.local_uri;

  if (!storagePath) return '';
  return `${BUCKET_URL}/${storagePath}`;
}

export async function cacheRemotePhoto(
  photoId: string,
  momentId: string,
  storagePath: string
): Promise<string | null> {
  const existing = getPhotoLocalUri(photoId);
  if (existing && await fileExists(existing)) return existing;

  const standardCachePath = getCachedPhotoPath(momentId, photoId);
  if (await fileExists(standardCachePath)) {
    registerPhotoFile(photoId, momentId, standardCachePath);
    return standardCachePath;
  }

  if (!(await isOnline())) return null;

  try {
    const localUri = await downloadPhotoToCache(
      `${BUCKET_URL}/${storagePath}`,
      photoId,
      momentId
    );
    registerPhotoFile(photoId, momentId, localUri);
    return localUri;
  } catch {
    return null;
  }
}

function getCachedStoragePath(photoId: string): string | null {
  const row = db.getFirstSync<{ storage_path: string }>(
    `select storage_path from cached_photos where id = ?`,
    [photoId]
  );
  return row?.storage_path ?? null;
}

/** Resolve a readable on-device image file for CLIP embedding (never returns remote URLs). */
export async function resolveLocalPhotoUriForEmbedding(
  photoId: string,
  momentId: string,
  options?: { localUri?: string | null; storagePath?: string | null }
): Promise<string | null> {
  const candidates: string[] = [];

  if (options?.localUri) candidates.push(options.localUri);

  const queued = getByLocalId(photoId);
  if (queued?.local_uri) candidates.push(queued.local_uri);

  const registered = getPhotoLocalUri(photoId);
  if (registered) candidates.push(registered);

  candidates.push(getCachedPhotoPath(momentId, photoId));

  for (const uri of candidates) {
    if (!uri || isVideoUri(uri)) continue;
    if (await fileExists(uri)) return uri;
  }

  const storagePath = options?.storagePath ?? getCachedStoragePath(photoId);
  if (!storagePath || isVideoUri(storagePath)) return null;

  const downloaded = await cacheRemotePhoto(photoId, momentId, storagePath);
  if (!downloaded || isVideoUri(downloaded)) return null;

  return (await fileExists(downloaded)) ? downloaded : null;
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

  if (storagePath) {
    return `${BUCKET_URL}/${storagePath}`;
  }

  throw new Error('Photo file is not available on this device yet');
}
