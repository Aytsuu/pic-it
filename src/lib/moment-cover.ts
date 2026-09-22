import { db } from '@/lib/db';
import { isVideoUri } from '@/lib/media-uri';
import { getCachedPhotos, savePhotos } from '@/lib/offline-cache';
import { isOnline } from '@/lib/network';
import { getPhotoDisplayUri, getPhotoLocalUri } from '@/lib/photo-cache';
import * as queue from '@/lib/queue';
import { supabase } from '@/lib/supabase';
import { Image } from 'expo-image';

export type MomentPhoto = {
  id: string;
  moment_id: string;
  storage_path: string;
  created_at: string;
};

export type ResolvedMomentCover = {
  momentId: string;
  photoId: string | null;
  storagePath: string | null;
  photos: MomentPhoto[];
};

export function getSavedCoverPhotoId(userId: string, momentId: string): string | null {
  const row = db.getFirstSync<{ photo_id: string }>(
    `select photo_id from moment_cover_photos where user_id = ? and moment_id = ?`,
    [userId, momentId]
  );
  return row?.photo_id ?? null;
}

export function setMomentCoverPhoto(userId: string, momentId: string, photoId: string): void {
  db.runSync(
    `insert or replace into moment_cover_photos (user_id, moment_id, photo_id, updated_at)
     values (?, ?, ?, ?)`,
    [userId, momentId, photoId, Date.now()]
  );
}

export function remapCoverPhotoId(localId: string, remoteId: string): void {
  db.runSync(`update moment_cover_photos set photo_id = ? where photo_id = ?`, [remoteId, localId]);
}

function resolveCoverForMoment(
  userId: string,
  momentId: string,
  photos: MomentPhoto[]
): { photoId: string | null; storagePath: string | null } {
  const savedId = getSavedCoverPhotoId(userId, momentId);
  const saved = savedId ? photos.find((photo) => photo.id === savedId) : null;

  if (saved) {
    return { photoId: saved.id, storagePath: saved.storage_path };
  }

  if (savedId && getPhotoLocalUri(savedId)) {
    return { photoId: savedId, storagePath: '' };
  }

  if (photos.length === 0) {
    return { photoId: null, storagePath: null };
  }

  const cover = photos[0];
  return { photoId: cover.id, storagePath: cover.storage_path };
}

function cachedAsMomentPhotos(momentId: string): MomentPhoto[] {
  return getCachedPhotos(momentId).map((photo) => ({
    id: photo.id,
    moment_id: momentId,
    storage_path: photo.storage_path,
    created_at: photo.created_at,
  }));
}

export function mergeCoverPhotosWithLocal(momentId: string, photos: MomentPhoto[]): MomentPhoto[] {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const knownIds = new Set(photos.map((photo) => photo.id));

  for (const photo of queue.getAll(momentId)) {
    if (photo.remote_id && knownIds.has(photo.remote_id)) continue;
    if (byId.has(photo.local_id)) continue;

    byId.set(photo.local_id, {
      id: photo.local_id,
      moment_id: momentId,
      storage_path: '',
      created_at: new Date(photo.created_at).toISOString(),
    });
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function isSameCoverPhoto(photoId: string, selectedPhotoId: string | null): boolean {
  if (!selectedPhotoId) return false;
  if (photoId === selectedPhotoId) return true;
  if (queue.getRemoteId(photoId) === selectedPhotoId) return true;
  return queue.getByRemoteId(selectedPhotoId)?.local_id === photoId;
}

async function fetchPhotosByMoments(momentIds: string[]): Promise<Map<string, MomentPhoto[]>> {
  const grouped = new Map<string, MomentPhoto[]>();

  for (const momentId of momentIds) {
    grouped.set(momentId, cachedAsMomentPhotos(momentId));
  }

  if (await isOnline()) {
    const { data, error } = await supabase
      .from('photos')
      .select('id, moment_id, storage_path, created_at')
      .in('moment_id', momentIds)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const remoteByMoment = new Map<string, MomentPhoto[]>();
      for (const momentId of momentIds) {
        remoteByMoment.set(momentId, []);
      }

      for (const photo of data as MomentPhoto[]) {
        const list = remoteByMoment.get(photo.moment_id) ?? [];
        list.push(photo);
        remoteByMoment.set(photo.moment_id, list);
      }

      for (const momentId of momentIds) {
        const remote = remoteByMoment.get(momentId) ?? [];
        grouped.set(momentId, remote);
        savePhotos(
          momentId,
          remote.map((photo) => ({
            id: photo.id,
            storage_path: photo.storage_path,
            created_at: photo.created_at,
          }))
        );
      }
    }
  }

  for (const momentId of momentIds) {
    grouped.set(momentId, mergeCoverPhotosWithLocal(momentId, grouped.get(momentId) ?? []));
  }

  return grouped;
}

export function getCoverStillPhotos(photos: MomentPhoto[]): MomentPhoto[] {
  return photos.filter((photo) => {
    if (isVideoUri(photo.storage_path)) return false;
    if (photo.storage_path) return true;

    const localUri = getPhotoLocalUri(photo.id);
    if (localUri) return !isVideoUri(localUri);

    const displayUri = getPhotoDisplayUri(photo.id, '');
    return displayUri ? !isVideoUri(displayUri) : true;
  });
}

export function prefetchCoverStills(photos: MomentPhoto[], limit = 12): void {
  const uris = getCoverStillPhotos(photos)
    .slice(0, limit)
    .map((photo) => getPhotoDisplayUri(photo.id, photo.storage_path))
    .filter(Boolean);

  if (uris.length === 0) return;

  void Image.prefetch(uris, 'memory-disk');
}

export async function fetchMomentCovers(
  userId: string,
  momentIds: string[]
): Promise<ResolvedMomentCover[]> {
  if (momentIds.length === 0) return [];

  const photosByMoment = await fetchPhotosByMoments(momentIds);

  return momentIds.map((momentId) => {
    const photos = photosByMoment.get(momentId) ?? [];
    const cover = resolveCoverForMoment(userId, momentId, photos);

    return {
      momentId,
      photoId: cover.photoId,
      storagePath: cover.storagePath,
      photos,
    };
  });
}
