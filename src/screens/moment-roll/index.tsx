import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { GridItem, PhotoGrid } from '@/components/photo-grid';
import { useAuth } from '@/hooks/use-auth';
import {
  CachedPhoto,
  fetchWithCache,
  getCachedPhotos,
  savePhotos,
} from '@/lib/offline-cache';
import { getAll, resetForRetry, SyncStatus, toDisplayStatus } from '@/lib/queue';
import { supabase } from '@/lib/supabase';
import { syncMoment } from '@/lib/sync';

type RemotePhoto = {
  id: string;
  storage_path: string;
  created_at: string;
};

const BUCKET_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/moment-photos`;

type SortedGridItem = GridItem & { sortTime: number };

export function MomentRollScreen() {
  const { id: momentId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [localRefreshKey, setLocalRefreshKey] = useState(0);

  const remoteQuery = useQuery({
    queryKey: ['photos', momentId],
    enabled: !!momentId,
    queryFn: async () => {
      const id = momentId!;

      return fetchWithCache<RemotePhoto[]>({
        fetchRemote: async () => {
          const { data, error } = await supabase
            .from('photos')
            .select('id, storage_path, created_at')
            .eq('moment_id', id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return (data ?? []) as RemotePhoto[];
        },
        readCache: () => getCachedPhotos(id) as RemotePhoto[],
        writeCache: (photos) => savePhotos(id, photos as CachedPhoto[]),
      });
    },
  });

  useFocusEffect(
    useCallback(() => {
      setLocalRefreshKey((key) => key + 1);
    }, [])
  );

  useEffect(() => {
    if (!momentId) return;

    const channel = supabase
      .channel(`photos:${momentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'photos',
          filter: `moment_id=eq.${momentId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['photos', momentId] });
          setLocalRefreshKey((key) => key + 1);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [momentId, queryClient]);

  const items = useMemo(() => {
    const remote = remoteQuery.data ?? [];
    const syncedRemoteIds = new Set(remote.map((photo) => photo.id));

    const local = getAll(momentId ?? '').filter((photo) => {
      if (photo.sync_status === 'synced') {
        return !syncedRemoteIds.has(photo.remote_id ?? '');
      }
      return true;
    });

    const remoteItems: SortedGridItem[] = remote.map((photo) => ({
      key: photo.id,
      source: `${BUCKET_URL}/${photo.storage_path}`,
      syncStatus: 'synced' as SyncStatus,
      sortTime: new Date(photo.created_at).getTime(),
    }));

    const localItems: SortedGridItem[] = local.map((photo) => ({
      key: photo.local_id,
      source: photo.local_uri,
      syncStatus: toDisplayStatus(photo.sync_status),
      sortTime: photo.created_at,
      onFailedPress:
        photo.sync_status === 'failed'
          ? () => {
              Alert.alert('Retry upload?', 'Try uploading this photo again.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Retry',
                  onPress: () => {
                    if (!user || !momentId) return;
                    resetForRetry(photo.local_id);
                    void syncMoment(momentId, user.id).then(() => {
                      setLocalRefreshKey((key) => key + 1);
                    });
                  },
                },
              ]);
            }
          : undefined,
    }));

    return [...remoteItems, ...localItems]
      .sort((a, b) => b.sortTime - a.sortTime)
      .map(({ sortTime: _sortTime, ...item }) => item);
  }, [remoteQuery.data, momentId, user, localRefreshKey]);

  return (
    <View style={{ flex: 1 }}>
      <PhotoGrid items={items} />
      <TouchableOpacity
        onPress={() => router.push(`/moment/${momentId}/camera` as any)}
        style={{
          position: 'absolute',
          bottom: 32,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: '#208AEF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 28 }}>📷</Text>
      </TouchableOpacity>
    </View>
  );
}
