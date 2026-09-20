import { db } from '@/lib/db';
import { getCachedPhotos } from '@/lib/offline-cache';
import { isOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';

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

function resolveCoverForMoment(
  userId: string,
  momentId: string,
  photos: MomentPhoto[]
): { photoId: string | null; storagePath: string | null } {
  if (photos.length === 0) {
    return { photoId: null, storagePath: null };
  }

  const savedId = getSavedCoverPhotoId(userId, momentId);
  const saved = savedId ? photos.find((photo) => photo.id === savedId) : null;
  const cover = saved ?? photos[0];

  return { photoId: cover.id, storagePath: cover.storage_path };
}

async function fetchPhotosByMoments(momentIds: string[]): Promise<Map<string, MomentPhoto[]>> {
  const grouped = new Map<string, MomentPhoto[]>();

  for (const momentId of momentIds) {
    grouped.set(momentId, []);
  }

  if (await isOnline()) {
    const { data, error } = await supabase
      .from('photos')
      .select('id, moment_id, storage_path, created_at')
      .in('moment_id', momentIds)
      .order('created_at', { ascending: false });

    if (!error && data) {
      for (const photo of data as MomentPhoto[]) {
        const list = grouped.get(photo.moment_id) ?? [];
        list.push(photo);
        grouped.set(photo.moment_id, list);
      }
      return grouped;
    }
  }

  for (const momentId of momentIds) {
    const cached = getCachedPhotos(momentId);
    grouped.set(
      momentId,
      cached.map((photo) => ({
        id: photo.id,
        moment_id: momentId,
        storage_path: photo.storage_path,
        created_at: photo.created_at,
      }))
    );
  }

  return grouped;
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
