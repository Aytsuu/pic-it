import { useCallback, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { saveImageToGallery } from '@/lib/gallery';
import { isOnline } from '@/lib/network';
import {
  getCachedPickIds,
  getPendingPickIds,
  saveCachedPicks,
  savePendingPicks,
} from '@/lib/picks-cache';
import { resolvePhotoUri } from '@/lib/photo-cache';
import { getRemoteId, isUnsyncedLocalId } from '@/lib/queue';
import { supabase } from '@/lib/supabase';

type PickRow = {
  photo_id: string;
};

export function usePicks(momentId: string) {
  const { user } = useAuth();
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const fetchPicks = useCallback(async () => {
    if (!user) return;

    const localIds = new Set([
      ...getCachedPickIds(user.id, momentId),
      ...getPendingPickIds(user.id, momentId),
    ]);

    if (!(await isOnline())) {
      setPickedIds(localIds);
      return;
    }

    const { data: momentPhotos, error: photosError } = await supabase
      .from('photos')
      .select('id')
      .eq('moment_id', momentId);

    if (photosError || !momentPhotos?.length) {
      setPickedIds(localIds);
      return;
    }

    const photoIds = momentPhotos.map((photo) => photo.id);
    const { data, error } = await supabase
      .from('picks')
      .select('photo_id')
      .eq('user_id', user.id)
      .in('photo_id', photoIds);

    if (!error && data) {
      const remoteIds = (data as PickRow[]).map((row) => row.photo_id);
      saveCachedPicks(user.id, momentId, remoteIds);
      setPickedIds(new Set([...remoteIds, ...getPendingPickIds(user.id, momentId)]));
      return;
    }

    setPickedIds(localIds);
  }, [user, momentId]);

  const savePicks = useCallback(
    async (
      selectedIds: string[],
      storagePaths: Record<string, string>,
      localUris: Record<string, string> = {}
    ) => {
      if (!user || selectedIds.length === 0) return;
      setIsSaving(true);

      try {
        for (const photoId of selectedIds) {
          const localUri = await resolvePhotoUri(
            photoId,
            momentId,
            storagePaths[photoId],
            localUris[photoId]
          );
          await saveImageToGallery(localUri);
        }

        const remotePhotoIds = selectedIds
          .map((photoId) => {
            if (storagePaths[photoId]) return photoId;
            const remoteId = getRemoteId(photoId);
            if (remoteId) return remoteId;
            if (isUnsyncedLocalId(photoId)) return null;
            return photoId;
          })
          .filter((photoId): photoId is string => photoId !== null);

        const localOnlyIds = selectedIds.filter((photoId) => isUnsyncedLocalId(photoId));

        if (remotePhotoIds.length > 0 && (await isOnline())) {
          const rows = remotePhotoIds.map((photo_id) => ({
            user_id: user.id,
            photo_id,
          }));
          const { error: upsertErr } = await supabase.from('picks').upsert(rows, {
            onConflict: 'user_id,photo_id',
          });
          if (upsertErr) throw upsertErr;
          saveCachedPicks(user.id, momentId, remotePhotoIds);
        }

        if (localOnlyIds.length > 0) {
          savePendingPicks(user.id, momentId, localOnlyIds);
        }

        if (!(await isOnline()) && remotePhotoIds.length > 0) {
          savePendingPicks(user.id, momentId, remotePhotoIds);
        }

        setPickedIds((prev) => new Set([...prev, ...selectedIds]));
      } finally {
        setIsSaving(false);
      }
    },
    [user, momentId]
  );

  return { pickedIds, fetchPicks, savePicks, isSaving };
}
