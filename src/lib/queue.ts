import { randomUUID } from 'expo-crypto';

import { db } from '@/lib/db';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type UnsyncedPhoto = {
  local_id: string;
  moment_id: string;
  local_uri: string;
  created_at: number;
  sync_status: SyncStatus;
  remote_id: string | null;
  attempts: number;
};

const MAX_ATTEMPTS = 5;

export function enqueue(momentId: string, localUri: string): UnsyncedPhoto {
  const local_id = randomUUID();
  const created_at = Date.now();

  db.runSync(
    `insert into unsynced_photos (local_id, moment_id, local_uri, created_at)
     values (?, ?, ?, ?)`,
    [local_id, momentId, localUri, created_at]
  );

  return {
    local_id,
    moment_id: momentId,
    local_uri: localUri,
    created_at,
    sync_status: 'pending',
    remote_id: null,
    attempts: 0,
  };
}

export function getAll(momentId: string): UnsyncedPhoto[] {
  return db.getAllSync<UnsyncedPhoto>(
    `select * from unsynced_photos where moment_id = ? order by created_at desc`,
    [momentId]
  );
}

export function getPending(momentId: string): UnsyncedPhoto[] {
  return db.getAllSync<UnsyncedPhoto>(
    `select * from unsynced_photos where moment_id = ? and sync_status = 'pending' order by created_at asc`,
    [momentId]
  );
}

/** Atomically move a row from pending → syncing. Returns false if another sync already claimed it. */
export function tryClaimForSync(localId: string): boolean {
  db.runSync(
    `update unsynced_photos
     set sync_status = 'syncing'
     where local_id = ? and sync_status = 'pending'`,
    [localId]
  );

  const row = db.getFirstSync<{ sync_status: SyncStatus }>(
    `select sync_status from unsynced_photos where local_id = ?`,
    [localId]
  );

  return row?.sync_status === 'syncing';
}

export function markSynced(localId: string, remoteId: string): void {
  db.runSync(
    `update unsynced_photos set sync_status = 'synced', remote_id = ? where local_id = ?`,
    [remoteId, localId]
  );
}

export function markFailed(localId: string): void {
  db.runSync(
    `update unsynced_photos
     set attempts = attempts + 1,
         sync_status = case when attempts + 1 >= ? then 'failed' else 'pending' end
     where local_id = ? and sync_status in ('pending', 'syncing')`,
    [MAX_ATTEMPTS, localId]
  );
}

export function resetForRetry(localId: string): void {
  db.runSync(
    `update unsynced_photos set sync_status = 'pending' where local_id = ?`,
    [localId]
  );
}

/** Map syncing rows to pending for display purposes. */
export function toDisplayStatus(status: SyncStatus): SyncStatus {
  return status === 'syncing' ? 'pending' : status;
}
