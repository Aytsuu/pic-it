import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GridItem, PhotoGrid } from '@/components/photo-grid';
import { useAuth } from '@/hooks/use-auth';
import { useMomentPhotoInserts } from '@/hooks/use-moment-photo-inserts';
import { usePicks } from '@/hooks/use-picks';
import {
  CachedPhoto,
  fetchWithCache,
  getCachedPhotos,
  savePhotos,
} from '@/lib/offline-cache';
import { isOnline } from '@/lib/network';
import { cacheRemotePhotos, getPhotoDisplayUri } from '@/lib/photo-cache';
import { getAll, resetForRetry, SyncStatus, toDisplayStatus } from '@/lib/queue';
import { supabase } from '@/lib/supabase';
import { syncMoment } from '@/lib/sync';

type RemotePhoto = {
  id: string;
  storage_path: string;
  created_at: string;
  uploaded_by: string;
};

type SortedGridItem = GridItem & { sortTime: number };

export function MomentRollScreen() {
  const { id: momentId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const storagePathsRef = useRef<Record<string, string>>({});
  const localUrisRef = useRef<Record<string, string>>({});

  const { pickedIds, fetchPicks, savePicks, isSaving } = usePicks(momentId ?? '');

  const remoteQuery = useQuery({
    queryKey: ['photos', momentId],
    enabled: !!momentId,
    queryFn: async () => {
      const id = momentId!;

      const photos = await fetchWithCache<RemotePhoto[]>({
        fetchRemote: async () => {
          const { data, error } = await supabase
            .from('photos')
            .select('id, storage_path, created_at, uploaded_by')
            .eq('moment_id', id)
            .order('created_at', { ascending: false });

          if (error) throw error;
          return (data ?? []) as RemotePhoto[];
        },
        readCache: () => getCachedPhotos(id) as RemotePhoto[],
        writeCache: (cachedPhotos) => savePhotos(id, cachedPhotos as CachedPhoto[]),
      });

      if (await isOnline()) {
        await cacheRemotePhotos(id, photos);
        setLocalRefreshKey((key) => key + 1);
      }

      return photos;
    },
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const onPhotosChanged = useCallback(() => {
    if (!momentId) return;
    void queryClient.invalidateQueries({ queryKey: ['photos', momentId] });
    setLocalRefreshKey((key) => key + 1);
  }, [momentId, queryClient]);

  useFocusEffect(
    useCallback(() => {
      setLocalRefreshKey((key) => key + 1);
      void fetchPicks();
    }, [fetchPicks])
  );

  useMomentPhotoInserts(momentId, onPhotosChanged);

  const items = useMemo(() => {
    const remote = remoteQuery.data ?? [];
    const syncedRemoteIds = new Set(remote.map((photo) => photo.id));

    storagePathsRef.current = Object.fromEntries(
      remote.map((photo) => [photo.id, photo.storage_path])
    );

    const local = getAll(momentId ?? '').filter((photo) => {
      if (photo.sync_status === 'synced') {
        return !syncedRemoteIds.has(photo.remote_id ?? '');
      }
      return true;
    });

    localUrisRef.current = Object.fromEntries(
      local.map((photo) => [photo.local_id, photo.local_uri])
    );

    const remoteItems: SortedGridItem[] = remote.map((photo) => ({
      key: photo.id,
      source: getPhotoDisplayUri(photo.id, photo.storage_path),
      syncStatus: 'synced' as SyncStatus,
      sortTime: new Date(photo.created_at).getTime(),
      isPicked: pickedIds.has(photo.id),
      isSelected: selectedIds.has(photo.id),
      onPress: isSelecting ? () => toggleSelect(photo.id) : undefined,
      onDetailPress: !isSelecting
        ? () =>
            router.push({
              pathname: '/moment/[id]/photo/[photoId]' as any,
              params: {
                id: momentId!,
                photoId: photo.id,
                storagePath: photo.storage_path,
                canDelete: photo.uploaded_by === user?.id ? '1' : '0',
              },
            })
        : undefined,
    }));

    const localItems: SortedGridItem[] = local.map((photo) => ({
      key: photo.local_id,
      source: photo.local_uri,
      syncStatus: toDisplayStatus(photo.sync_status),
      sortTime: photo.created_at,
      isPicked: pickedIds.has(photo.local_id),
      isSelected: selectedIds.has(photo.local_id),
      onPress: isSelecting ? () => toggleSelect(photo.local_id) : undefined,
      onDetailPress: !isSelecting
        ? () =>
            router.push({
              pathname: '/moment/[id]/photo/[photoId]' as any,
              params: {
                id: momentId!,
                photoId: photo.local_id,
                canDelete: '1',
              },
            })
        : undefined,
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
  }, [remoteQuery.data, momentId, user, localRefreshKey, pickedIds, selectedIds, isSelecting, router]);

  async function handlePicIt() {
    try {
      await savePicks([...selectedIds], storagePathsRef.current, localUrisRef.current);
      setIsSelecting(false);
      setSelectedIds(new Set());
      Alert.alert(
        'Saved',
        (await isOnline())
          ? 'Your picks were saved to Pic It and your camera roll.'
          : 'Saved to your camera roll. Picks will sync to Pic It when you are back online.'
      );
    } catch (err) {
      Alert.alert(
        'Could not save picks',
        err instanceof Error ? err.message : 'Something went wrong'
      );
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          padding: 8,
          paddingTop: 48,
        }}
      >
        <Pressable
          onPress={() => {
            setIsSelecting((prev) => !prev);
            setSelectedIds(new Set());
          }}
          style={{ padding: 8 }}
        >
          <Text style={{ color: '#007AFF', fontSize: 16 }}>
            {isSelecting ? 'Cancel' : 'Select'}
          </Text>
        </Pressable>
      </View>

      <PhotoGrid items={items} />

      {!isSelecting && (
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
      )}

      {isSelecting && selectedIds.size > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#fff',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: '#ccc',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingVertical: 16,
            paddingBottom: 32,
          }}
        >
          <Text style={{ fontSize: 16, color: '#333' }}>{selectedIds.size} selected</Text>
          <Pressable
            onPress={() => void handlePicIt()}
            disabled={isSaving}
            style={{
              backgroundColor: '#208AEF',
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 20,
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              {isSaving ? 'Saving…' : 'Pic it'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
