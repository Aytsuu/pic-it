import { db } from '@/lib/db';
import { isOnline } from '@/lib/network';

export type CachedMoment = {
  id: string;
  name: string;
  created_at: string;
};

export type CachedPhoto = {
  id: string;
  storage_path: string;
  created_at: string;
  uploaded_by?: string;
};

export type CachedMemberRow = {
  moment_id: string;
  moments: CachedMoment;
};

export function saveMoments(userId: string, moments: CachedMoment[]): void {
  const cachedAt = Date.now();

  for (const moment of moments) {
    db.runSync(
      `insert or replace into cached_moments (user_id, moment_id, name, created_at, cached_at)
       values (?, ?, ?, ?, ?)`,
      [userId, moment.id, moment.name, moment.created_at, cachedAt]
    );
  }
}

export function getCachedMoments(userId: string): CachedMemberRow[] {
  const rows = db.getAllSync<{
    moment_id: string;
    name: string;
    created_at: string;
  }>(
    `select moment_id, name, created_at
     from cached_moments
     where user_id = ?
     order by created_at desc`,
    [userId]
  );

  return rows.map((row) => ({
    moment_id: row.moment_id,
    moments: {
      id: row.moment_id,
      name: row.name,
      created_at: row.created_at,
    },
  }));
}

export function savePhotos(momentId: string, photos: CachedPhoto[]): void {
  const cachedAt = Date.now();

  db.runSync(`delete from cached_photos where moment_id = ?`, [momentId]);

  for (const photo of photos) {
    db.runSync(
      `insert into cached_photos (id, moment_id, storage_path, created_at, cached_at)
       values (?, ?, ?, ?, ?)`,
      [photo.id, momentId, photo.storage_path, photo.created_at, cachedAt]
    );
  }
}

export function getCachedPhotos(momentId: string): CachedPhoto[] {
  return db.getAllSync<CachedPhoto>(
    `select id, storage_path, created_at
     from cached_photos
     where moment_id = ?
     order by created_at desc`,
    [momentId]
  );
}

export function removeCachedPhoto(momentId: string, photoId: string): void {
  db.runSync(`delete from cached_photos where moment_id = ? and id = ?`, [momentId, photoId]);
}

export async function fetchWithCache<T>({
  fetchRemote,
  readCache,
  writeCache,
}: {
  fetchRemote: () => Promise<T>;
  readCache: () => T;
  writeCache: (data: T) => void;
}): Promise<T> {
  if (!(await isOnline())) return readCache();

  try {
    const data = await fetchRemote();
    writeCache(data);
    return data;
  } catch {
    return readCache();
  }
}
