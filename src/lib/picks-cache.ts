import { db } from '@/lib/db';

export function saveCachedPicks(userId: string, momentId: string, photoIds: string[]): void {
  const cachedAt = Date.now();

  for (const photoId of photoIds) {
    db.runSync(
      `insert or replace into cached_picks (user_id, photo_id, moment_id, cached_at)
       values (?, ?, ?, ?)`,
      [userId, photoId, momentId, cachedAt]
    );
  }
}

export function getCachedPickIds(userId: string, momentId: string): string[] {
  const rows = db.getAllSync<{ photo_id: string }>(
    `select photo_id from cached_picks where user_id = ? and moment_id = ?`,
    [userId, momentId]
  );

  return rows.map((row) => row.photo_id);
}

export function savePendingPicks(userId: string, momentId: string, photoIds: string[]): void {
  const createdAt = Date.now();

  for (const photoId of photoIds) {
    db.runSync(
      `insert or replace into pending_picks (user_id, photo_id, moment_id, created_at)
       values (?, ?, ?, ?)`,
      [userId, photoId, momentId, createdAt]
    );
    db.runSync(
      `insert or replace into cached_picks (user_id, photo_id, moment_id, cached_at)
       values (?, ?, ?, ?)`,
      [userId, photoId, momentId, createdAt]
    );
  }
}

export function getPendingPickIds(userId: string, momentId: string): string[] {
  const rows = db.getAllSync<{ photo_id: string }>(
    `select photo_id from pending_picks where user_id = ? and moment_id = ?`,
    [userId, momentId]
  );

  return rows.map((row) => row.photo_id);
}

export function getAllPendingPickRows(userId: string): { photo_id: string; moment_id: string }[] {
  return db.getAllSync<{ photo_id: string; moment_id: string }>(
    `select photo_id, moment_id from pending_picks where user_id = ?`,
    [userId]
  );
}

export function clearPendingPicks(userId: string, photoIds: string[]): void {
  for (const photoId of photoIds) {
    db.runSync(`delete from pending_picks where user_id = ? and photo_id = ?`, [userId, photoId]);
  }
}

export function removePicksForPhoto(photoId: string): void {
  db.runSync(`delete from cached_picks where photo_id = ?`, [photoId]);
  db.runSync(`delete from pending_picks where photo_id = ?`, [photoId]);
}

export function remapPickPhotoId(userId: string, localId: string, remoteId: string): void {
  const cached = db.getFirstSync<{ moment_id: string; cached_at: number }>(
    `select moment_id, cached_at from cached_picks where user_id = ? and photo_id = ?`,
    [userId, localId]
  );

  const pending = db.getFirstSync<{ moment_id: string; created_at: number }>(
    `select moment_id, created_at from pending_picks where user_id = ? and photo_id = ?`,
    [userId, localId]
  );

  db.runSync(`delete from cached_picks where user_id = ? and photo_id = ?`, [userId, localId]);
  db.runSync(`delete from pending_picks where user_id = ? and photo_id = ?`, [userId, localId]);

  if (cached) {
    db.runSync(
      `insert or replace into cached_picks (user_id, photo_id, moment_id, cached_at)
       values (?, ?, ?, ?)`,
      [userId, remoteId, cached.moment_id, cached.cached_at]
    );
  }

  if (pending) {
    db.runSync(
      `insert or replace into pending_picks (user_id, photo_id, moment_id, created_at)
       values (?, ?, ?, ?)`,
      [userId, remoteId, pending.moment_id, pending.created_at]
    );
  }
}
