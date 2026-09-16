type UnsyncedPhotoRow = {
  local_id: string;
  moment_id: string;
  local_uri: string;
  created_at: number;
  sync_status: string;
  remote_id: string | null;
  attempts: number;
};

type CachedMomentRow = {
  user_id: string;
  moment_id: string;
  name: string;
  created_at: string;
  cached_at: number;
};

type CachedPhotoRow = {
  id: string;
  moment_id: string;
  storage_path: string;
  created_at: string;
  cached_at: number;
};

type PhotoFileRow = {
  photo_id: string;
  moment_id: string;
  local_uri: string;
  cached_at: number;
};

type CachedPickRow = {
  user_id: string;
  photo_id: string;
  moment_id: string;
  cached_at: number;
};

type PendingPickRow = {
  user_id: string;
  photo_id: string;
  moment_id: string;
  created_at: number;
};

const rows: UnsyncedPhotoRow[] = [];
const cachedMoments: CachedMomentRow[] = [];
const cachedPhotos: CachedPhotoRow[] = [];
const photoFiles: PhotoFileRow[] = [];
const cachedPicks: CachedPickRow[] = [];
const pendingPicks: PendingPickRow[] = [];

function matchWhere(sql: string, params: unknown[]): UnsyncedPhotoRow[] {
  if (sql.includes('sync_status = \'pending\'')) {
    const momentId = params[0] as string;
    return rows.filter(
      (row) => row.moment_id === momentId && row.sync_status === 'pending'
    );
  }

  const momentId = params[0] as string;
  return rows.filter((row) => row.moment_id === momentId);
}

function getDistinctPendingMomentIds(): { moment_id: string }[] {
  const seen = new Set<string>();

  return rows
    .filter((row) => row.sync_status === 'pending')
    .filter((row) => {
      if (seen.has(row.moment_id)) return false;
      seen.add(row.moment_id);
      return true;
    })
    .map((row) => ({ moment_id: row.moment_id }));
}

export const db = {
  execSync: () => {},
  getFirstSync: <T>(sql: string, params: unknown[] = []): T | null => {
    if (sql.includes('from photo_files')) {
      const [photo_id] = params as [string];
      const row = photoFiles.find((item) => item.photo_id === photo_id);
      return row ? ({ local_uri: row.local_uri } as T) : null;
    }

    const [local_id] = params as [string];
    const row = rows.find((item) => item.local_id === local_id);
    return row ? ({ sync_status: row.sync_status } as T) : null;
  },
  runSync: (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('insert into unsynced_photos')) {
      const [local_id, moment_id, local_uri, created_at] = params as [
        string,
        string,
        string,
        number,
      ];
      rows.push({
        local_id,
        moment_id,
        local_uri,
        created_at,
        sync_status: 'pending',
        remote_id: null,
        attempts: 0,
      });
      return;
    }

    if (sql.includes('insert or replace into cached_moments')) {
      const [user_id, moment_id, name, created_at, cached_at] = params as [
        string,
        string,
        string,
        string,
        number,
      ];
      const index = cachedMoments.findIndex(
        (row) => row.user_id === user_id && row.moment_id === moment_id
      );
      const next = { user_id, moment_id, name, created_at, cached_at };
      if (index >= 0) cachedMoments[index] = next;
      else cachedMoments.push(next);
      return;
    }

    if (sql.startsWith('delete from cached_photos')) {
      const [moment_id] = params as [string];
      for (let i = cachedPhotos.length - 1; i >= 0; i -= 1) {
        if (cachedPhotos[i].moment_id === moment_id) cachedPhotos.splice(i, 1);
      }
      return;
    }

    if (sql.startsWith('insert into cached_photos')) {
      const [id, moment_id, storage_path, created_at, cached_at] = params as [
        string,
        string,
        string,
        string,
        number,
      ];
      cachedPhotos.push({ id, moment_id, storage_path, created_at, cached_at });
      return;
    }

    if (sql.includes("sync_status = 'synced'")) {
      const [remote_id, local_id] = params as [string, string];
      const row = rows.find((item) => item.local_id === local_id);
      if (row) {
        row.sync_status = 'synced';
        row.remote_id = remote_id;
      }
      return;
    }

    if (sql.includes("sync_status = 'syncing'")) {
      const [local_id] = params as [string];
      const row = rows.find((item) => item.local_id === local_id);
      if (row && row.sync_status === 'pending') {
        row.sync_status = 'syncing';
      }
      return;
    }

    if (sql.includes('attempts = attempts + 1')) {
      const [, local_id] = params as [number, string];
      const row = rows.find((item) => item.local_id === local_id);
      if (row && (row.sync_status === 'pending' || row.sync_status === 'syncing')) {
        row.attempts += 1;
        row.sync_status = row.attempts >= 5 ? 'failed' : 'pending';
      }
      return;
    }

    if (sql.includes("sync_status = 'pending' where local_id")) {
      const [local_id] = params as [string];
      const row = rows.find((item) => item.local_id === local_id);
      if (row) row.sync_status = 'pending';
      return;
    }

    if (sql.includes('insert or replace into photo_files')) {
      const [photo_id, moment_id, local_uri, cached_at] = params as [
        string,
        string,
        string,
        number,
      ];
      const index = photoFiles.findIndex((row) => row.photo_id === photo_id);
      const next = { photo_id, moment_id, local_uri, cached_at };
      if (index >= 0) photoFiles[index] = next;
      else photoFiles.push(next);
      return;
    }

    if (sql.includes('insert or replace into cached_picks')) {
      const [user_id, photo_id, moment_id, cached_at] = params as [
        string,
        string,
        string,
        number,
      ];
      const index = cachedPicks.findIndex(
        (row) => row.user_id === user_id && row.photo_id === photo_id
      );
      const next = { user_id, photo_id, moment_id, cached_at };
      if (index >= 0) cachedPicks[index] = next;
      else cachedPicks.push(next);
      return;
    }

    if (sql.includes('insert or replace into pending_picks')) {
      const [user_id, photo_id, moment_id, created_at] = params as [
        string,
        string,
        string,
        number,
      ];
      const index = pendingPicks.findIndex(
        (row) => row.user_id === user_id && row.photo_id === photo_id
      );
      const next = { user_id, photo_id, moment_id, created_at };
      if (index >= 0) pendingPicks[index] = next;
      else pendingPicks.push(next);
      return;
    }

    if (sql.startsWith('delete from pending_picks')) {
      const [user_id, photo_id] = params as [string, string];
      const index = pendingPicks.findIndex(
        (row) => row.user_id === user_id && row.photo_id === photo_id
      );
      if (index >= 0) pendingPicks.splice(index, 1);
    }
  },
  getAllSync: <T>(sql: string, params: unknown[] = []): T[] => {
    if (sql.includes('from cached_moments')) {
      const [user_id] = params as [string];
      return cachedMoments
        .filter((row) => row.user_id === user_id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) => ({
          moment_id: row.moment_id,
          name: row.name,
          created_at: row.created_at,
        })) as T[];
    }

    if (sql.includes('from cached_photos')) {
      const [moment_id] = params as [string];
      return cachedPhotos
        .filter((row) => row.moment_id === moment_id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) => ({
          id: row.id,
          storage_path: row.storage_path,
          created_at: row.created_at,
        })) as T[];
    }

    if (sql.includes('from cached_picks')) {
      const [user_id, moment_id] = params as [string, string];
      return cachedPicks
        .filter((row) => row.user_id === user_id && row.moment_id === moment_id)
        .map((row) => ({ photo_id: row.photo_id })) as T[];
    }

    if (sql.includes('from pending_picks')) {
      const [user_id, moment_id] = params as [string, string | undefined];
      if (moment_id !== undefined) {
        return pendingPicks
          .filter((row) => row.user_id === user_id && row.moment_id === moment_id)
          .map((row) => ({ photo_id: row.photo_id })) as T[];
      }

      return pendingPicks
        .filter((row) => row.user_id === user_id)
        .map((row) => ({ photo_id: row.photo_id, moment_id: row.moment_id })) as T[];
    }

    if (sql.includes('distinct moment_id')) {
      return getDistinctPendingMomentIds() as T[];
    }

    const matched = matchWhere(sql, params);

    if (sql.includes('order by created_at desc')) {
      return [...matched]
        .sort((a, b) => b.created_at - a.created_at)
        .map((row) => ({ ...row })) as T[];
    }

    if (sql.includes('order by created_at asc')) {
      return [...matched]
        .sort((a, b) => a.created_at - b.created_at)
        .map((row) => ({ ...row })) as T[];
    }

    return matched.map((row) => ({ ...row })) as T[];
  },
};
