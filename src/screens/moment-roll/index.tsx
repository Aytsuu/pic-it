import { BlurTargetView } from 'expo-blur';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type View as RNView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentBottomNav } from '@/components/moment-bottom-nav';
import {
  getMomentHeaderScrollInset,
  MomentNameHeader,
} from '@/components/moment-name-header';
import { GridItem, PhotoGrid } from '@/components/photo-grid';
import { SemanticSearchOverlay } from '@/components/semantic-search-overlay';
import { MomentInfoOverlay } from '@/components/moment-info-overlay';
import { useAuth } from '@/hooks/use-auth';
import { useMomentPhotoInserts } from '@/hooks/use-moment-photo-inserts';
import { usePicks } from '@/hooks/use-picks';
import { useSemanticSearch } from '@/hooks/use-semantic-search';
import {
  CachedPhoto,
  fetchWithCache,
  getCachedMoment,
  getCachedPhotos,
  getRememberedMomentName,
  rememberMomentName,
  saveMoments,
  savePhotos,
} from '@/lib/offline-cache';
import { isOnline } from '@/lib/network';
import { cacheRemotePhotos, getPhotoDisplayUri } from '@/lib/photo-cache';
import { getAll, resetForRetry, SyncStatus, toDisplayStatus } from '@/lib/queue';
import type { SearchResult } from '@/lib/semantic-search';
import { supabase } from '@/lib/supabase';
import { syncMoment } from '@/lib/sync';

type RemotePhoto = {
  id: string;
  storage_path: string;
  created_at: string;
  uploaded_by: string;
};

type SortedGridItem = GridItem & { sortTime: number };

const NAV_CLEARANCE = 96;

function normalizeParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function MomentRollScreen() {
  const { id: rawMomentId, name: rawMomentName } = useLocalSearchParams<{
    id: string;
    name?: string;
  }>();
  const momentId = normalizeParam(rawMomentId);
  const paramName = normalizeParam(rawMomentName);
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const blurTargetRef = useRef<RNView>(null);
  const [localRefreshKey, setLocalRefreshKey] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [showInfoOverlay, setShowInfoOverlay] = useState(false);
  const storagePathsRef = useRef<Record<string, string>>({});
  const localUrisRef = useRef<Record<string, string>>({});

  const { pickedIds, fetchPicks, savePicks, isSaving } = usePicks(momentId ?? '');
  const {
    query,
    onQueryChange,
    results: searchResults,
    isSearching,
    modelsReady,
    downloadProgress,
    error: searchError,
    emptyMessage: searchEmptyMessage,
    isPreviewMode: isSearchPreviewMode,
  } = useSemanticSearch(momentId);

  const resolvedName = useMemo(() => {
    if (!momentId) return paramName;
    return (
      getRememberedMomentName(momentId) ??
      paramName ??
      (user ? getCachedMoment(user.id, momentId)?.name : undefined)
    );
  }, [momentId, paramName, user]);

  const [momentName, setMomentName] = useState(resolvedName ?? '');

  useLayoutEffect(() => {
    setMomentName(resolvedName ?? '');
  }, [resolvedName]);

  const momentQuery = useQuery({
    queryKey: ['moment', momentId, user?.id],
    enabled: !!momentId && !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const id = momentId!;
      const userId = user!.id;

      return fetchWithCache({
        fetchRemote: async () => {
          const { data, error } = await supabase
            .from('moments')
            .select('id, name, created_at')
            .eq('id', id)
            .single();

          if (error) throw error;

          saveMoments(userId, [
            {
              id: data.id,
              name: data.name,
              created_at: data.created_at,
            },
          ]);

          return { name: data.name };
        },
        readCache: () => {
          const cached = getCachedMoment(userId, id);
          if (!cached?.name) throw new Error('Moment name is not cached');
          return { name: cached.name };
        },
        writeCache: () => {},
      });
    },
  });

  useEffect(() => {
    const fetchedName = momentQuery.data?.name;
    if (!fetchedName || !momentId) return;
    rememberMomentName(momentId, fetchedName);
    setMomentName(fetchedName);
  }, [momentQuery.data?.name, momentId]);

  const remoteQuery = useQuery({
    queryKey: ['photos', momentId],
    enabled: !!momentId,
    placeholderData: () =>
      momentId ? (getCachedPhotos(momentId) as RemotePhoto[]) : [],
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
      .sort((a, b) => a.sortTime - b.sortTime)
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

  function handleSearchResultPress(result: SearchResult) {
    setShowSearchOverlay(false);
    router.push({
      pathname: '/moment/[id]/photo/[photoId]' as any,
      params: {
        id: momentId!,
        photoId: result.photoId,
        storagePath: result.storagePath,
        canDelete: '0',
      },
    });
  }

  function handleToggleSelect() {
    setIsSelecting((prev) => !prev);
    setSelectedIds(new Set());
  }

  const showPickBar = isSelecting && selectedIds.size > 0;
  const showBottomNav = !showPickBar;
  const photosReady = remoteQuery.isFetched || items.length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <BlurTargetView ref={blurTargetRef} style={styles.content} collapsable={false}>
        {photosReady ? (
          <PhotoGrid
            key={momentId}
            items={items}
            contentPaddingTop={getMomentHeaderScrollInset(insets.top)}
            contentPaddingBottom={NAV_CLEARANCE}
            isSelecting={isSelecting}
            initialScrollToEnd
          />
        ) : null}
      </BlurTargetView>

      <MomentNameHeader
        name={momentName || 'Moment'}
        blurTargetRef={blurTargetRef}
      />

      {showBottomNav ? (
        <MomentBottomNav
          onCamera={() => router.push(`/moment/${momentId}/camera` as any)}
          onSelect={handleToggleSelect}
          onSearch={() => setShowSearchOverlay(true)}
          onInfo={() => setShowInfoOverlay(true)}
          isSelecting={isSelecting}
        />
      ) : null}

      {showPickBar ? (
        <View style={styles.pickBar}>
          <Text style={styles.pickCount}>{selectedIds.size} selected</Text>
          <Pressable
            onPress={() => void handlePicIt()}
            disabled={isSaving}
            style={[styles.picItButton, isSaving && styles.picItButtonDisabled]}
          >
            <Text style={styles.picItButtonText}>{isSaving ? 'Saving…' : 'Pic it'}</Text>
          </Pressable>
        </View>
      ) : null}

      <SemanticSearchOverlay
        visible={showSearchOverlay}
        blurTargetRef={blurTargetRef}
        onClose={() => {
          setShowSearchOverlay(false);
          onQueryChange('');
        }}
        query={query}
        onQueryChange={onQueryChange}
        results={searchResults}
        isSearching={isSearching}
        modelsReady={modelsReady}
        downloadProgress={downloadProgress}
        error={searchError}
        emptyMessage={searchEmptyMessage}
        isPreviewMode={isSearchPreviewMode}
        onResultPress={handleSearchResultPress}
      />

      <MomentInfoOverlay
        visible={showInfoOverlay}
        momentId={Array.isArray(momentId) ? momentId[0] ?? '' : momentId ?? ''}
        blurTargetRef={blurTargetRef}
        onClose={() => setShowInfoOverlay(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  pickBar: {
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
  },
  pickCount: {
    fontSize: 16,
    color: '#333',
  },
  picItButton: {
    backgroundColor: '#208AEF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  picItButtonDisabled: {
    opacity: 0.6,
  },
  picItButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
