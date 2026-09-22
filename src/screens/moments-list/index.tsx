import { BlurTargetView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type View as RNView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateMomentOverlay } from '@/components/create-moment-overlay';
import { FloatingBottomNav } from '@/components/floating-bottom-nav';
import { JoinMomentOverlay } from '@/components/join-moment-overlay';
import { MomentCoverPicker } from '@/components/moment-cover-picker';
import { MomentGridCard } from '@/components/moment-grid-card';
import { SemanticSearchOverlay } from '@/components/semantic-search-overlay';
import { SettingsOverlay } from '@/components/settings-overlay';
import { useAuth } from '@/hooks/use-auth';
import { useMomentsPhotoChanges } from '@/hooks/use-moment-photo-inserts';
import { useSemanticSearch } from '@/hooks/use-semantic-search';
import {
  fetchMomentCovers,
  mergeCoverPhotosWithLocal,
  prefetchCoverStills,
  setMomentCoverPhoto,
  type ResolvedMomentCover,
} from '@/lib/moment-cover';
import {
  CachedMemberRow,
  fetchWithCache,
  getCachedMoments,
  saveMoments,
} from '@/lib/offline-cache';
import { registerPhotoFile } from '@/lib/photo-cache';
import * as queue from '@/lib/queue';
import type { SearchResult } from '@/lib/semantic-search';
import { supabase } from '@/lib/supabase';
import { scheduleSync } from '@/lib/sync';

type MomentSummary = {
  id: string;
  name: string;
  created_at: string;
};

type MemberRow = {
  moment_id: string;
  moments: MomentSummary | MomentSummary[] | null;
};

function getMoment(row: MemberRow | CachedMemberRow): MomentSummary | null {
  if (!row.moments) return null;
  return Array.isArray(row.moments) ? row.moments[0] ?? null : row.moments;
}

const GRID_GAP = 12;
const GRID_HORIZONTAL_PADDING = 16;

function AppTitleHeader() {
  return (
    <View style={styles.header}>
      <Text style={styles.appTitle}>Pic It</Text>
    </View>
  );
}

export function MomentsListScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - GRID_HORIZONTAL_PADDING * 2 - GRID_GAP) / 2;
  const queryClient = useQueryClient();
  const blurTargetRef = useRef<RNView>(null);
  const [showCreateOverlay, setShowCreateOverlay] = useState(false);
  const [showJoinOverlay, setShowJoinOverlay] = useState(false);
  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [coverPickerMomentId, setCoverPickerMomentId] = useState<string | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
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
  } = useSemanticSearch();

  const { data, isLoading } = useQuery({
    queryKey: ['moments', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const userId = user!.id;

      return fetchWithCache({
        fetchRemote: async () => {
          const { data: rows, error: queryError } = await supabase
            .from('members')
            .select('moment_id, moments(id, name, created_at)')
            .eq('user_id', userId);

          if (queryError) throw queryError;
          return (rows ?? []) as MemberRow[];
        },
        readCache: () => getCachedMoments(userId),
        writeCache: (rows) => {
          const moments = rows
            .map((row) => getMoment(row))
            .filter((moment): moment is MomentSummary => moment !== null);

          saveMoments(userId, moments);
        },
      });
    },
  });

  const momentIds = (data ?? []).map((row) => row.moment_id);

  const { data: momentCovers } = useQuery({
    queryKey: ['moment-covers', user?.id, momentIds],
    enabled: !!user && momentIds.length > 0,
    queryFn: () => fetchMomentCovers(user!.id, momentIds),
  });

  const coverByMomentId = new Map(
    (momentCovers ?? []).map((cover) => [cover.momentId, cover] as const)
  );

  const refreshCoverPhotos = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['moment-covers'] });
  }, [queryClient]);

  useFocusEffect(
    useCallback(() => {
      refreshCoverPhotos();
    }, [refreshCoverPhotos])
  );

  useMomentsPhotoChanges(momentIds, refreshCoverPhotos);

  useEffect(() => {
    if (!momentCovers) return;

    for (const cover of momentCovers) {
      prefetchCoverStills(cover.photos.slice(0, 12));
    }
  }, [momentCovers]);

  const coverPickerCover = coverPickerMomentId
    ? coverByMomentId.get(coverPickerMomentId)
    : undefined;

  const coverPickerPhotos = useMemo(
    () =>
      coverPickerMomentId
        ? mergeCoverPhotosWithLocal(coverPickerMomentId, coverPickerCover?.photos ?? [])
        : [],
    [coverPickerMomentId, coverPickerCover?.photos]
  );

  const coverPickerMoment = coverPickerMomentId
    ? getMoment((data ?? []).find((row) => row.moment_id === coverPickerMomentId)!)
    : null;

  function handleMomentCreated(momentId: string, name: string) {
    setShowCreateOverlay(false);
    void queryClient.invalidateQueries({ queryKey: ['moments', user?.id] });
    router.push({
      pathname: '/moment/[id]' as any,
      params: { id: momentId, name },
    });
  }

  function handleMomentJoined(momentId: string, name: string) {
    setShowJoinOverlay(false);
    void queryClient.invalidateQueries({ queryKey: ['moments', user?.id] });
    router.push({
      pathname: '/moment/[id]' as any,
      params: { id: momentId, name },
    });
  }

  function handleCoverSelected(momentId: string, photoId: string) {
    if (!user) return;

    setMomentCoverPhoto(user.id, momentId, photoId);
    setCoverPickerMomentId(null);
    void queryClient.invalidateQueries({ queryKey: ['moment-covers', user.id] });
  }

  async function handleCoverUpload() {
    if (!user || !coverPickerMomentId || isUploadingCover) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow Pic It to choose a cover from your library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    setIsUploadingCover(true);

    try {
      const queued = queue.enqueue(coverPickerMomentId, result.assets[0].uri);
      registerPhotoFile(queued.local_id, coverPickerMomentId, queued.local_uri);
      setMomentCoverPhoto(user.id, coverPickerMomentId, queued.local_id);
      setCoverPickerMomentId(null);
      void queryClient.invalidateQueries({ queryKey: ['moment-covers', user.id] });
      void scheduleSync(user.id, coverPickerMomentId);
    } catch {
      Alert.alert('Could not set cover', 'Try choosing another photo.');
    } finally {
      setIsUploadingCover(false);
    }
  }

  function handleSearchResultPress(result: SearchResult) {
    setShowSearchOverlay(false);
    router.push({
      pathname: '/moment/[id]/photo/[photoId]' as any,
      params: {
        id: result.momentId,
        photoId: result.photoId,
        storagePath: result.storagePath,
        canDelete: '0',
      },
    });
  }

  function renderMomentCard(item: MemberRow, cover?: ResolvedMomentCover) {
    const moment = getMoment(item);

    return (
      <View style={{ width: cardWidth }}>
        <MomentGridCard
          name={moment?.name ?? '—'}
          createdAt={moment?.created_at ?? ''}
          photoId={cover?.photoId ?? null}
          storagePath={cover?.storagePath ?? null}
          onPress={() =>
            router.push({
              pathname: '/moment/[id]' as any,
              params: { id: item.moment_id, name: moment?.name ?? '' },
            })
          }
          onLongPress={() => {
            prefetchCoverStills(cover?.photos ?? []);
            setCoverPickerMomentId(item.moment_id);
          }}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <AppTitleHeader />
        <ActivityIndicator style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!data?.length) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }} collapsable={false}>
          <AppTitleHeader />
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No moments yet</Text>
            <Text style={styles.emptySubtitle}>Create or join a moment to get started</Text>
          </View>
        </BlurTargetView>

        <FloatingBottomNav
          onJoin={() => setShowJoinOverlay(true)}
          onCreate={() => setShowCreateOverlay(true)}
          onSearch={() => setShowSearchOverlay(true)}
          onSettings={() => setShowSettingsOverlay(true)}
        />

        <CreateMomentOverlay
          visible={showCreateOverlay}
          blurTargetRef={blurTargetRef}
          onClose={() => setShowCreateOverlay(false)}
          onCreated={handleMomentCreated}
        />
        <JoinMomentOverlay
          visible={showJoinOverlay}
          blurTargetRef={blurTargetRef}
          onClose={() => setShowJoinOverlay(false)}
          onJoined={handleMomentJoined}
        />
        <SettingsOverlay
          visible={showSettingsOverlay}
          blurTargetRef={blurTargetRef}
          onClose={() => setShowSettingsOverlay(false)}
        />
        <SemanticSearchOverlay
          visible={showSearchOverlay}
          blurTargetRef={blurTargetRef}
          onClose={() => setShowSearchOverlay(false)}
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
        <MomentCoverPicker
          visible={coverPickerMomentId !== null}
          blurTargetRef={blurTargetRef}
          momentName={coverPickerMoment?.name ?? 'Moment'}
          photos={coverPickerPhotos}
          selectedPhotoId={coverPickerCover?.photoId ?? null}
          onClose={() => setCoverPickerMomentId(null)}
          onSelect={(photoId) => {
            if (coverPickerMomentId) handleCoverSelected(coverPickerMomentId, photoId);
          }}
          isUploading={isUploadingCover}
          onUpload={() => {
            void handleCoverUpload();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }} collapsable={false}>
        <View style={styles.content}>
          <AppTitleHeader />
          <FlatList
            data={data}
            keyExtractor={(item) => item.moment_id}
            numColumns={2}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item }) =>
              renderMomentCard(item, coverByMomentId.get(item.moment_id))
            }
          />
        </View>
      </BlurTargetView>

      <FloatingBottomNav
        onJoin={() => setShowJoinOverlay(true)}
        onCreate={() => setShowCreateOverlay(true)}
        onSearch={() => setShowSearchOverlay(true)}
        onSettings={() => setShowSettingsOverlay(true)}
      />

      <CreateMomentOverlay
        visible={showCreateOverlay}
        blurTargetRef={blurTargetRef}
        onClose={() => setShowCreateOverlay(false)}
        onCreated={handleMomentCreated}
      />
      <JoinMomentOverlay
        visible={showJoinOverlay}
        blurTargetRef={blurTargetRef}
        onClose={() => setShowJoinOverlay(false)}
        onJoined={handleMomentJoined}
      />
      <SettingsOverlay
        visible={showSettingsOverlay}
        blurTargetRef={blurTargetRef}
        onClose={() => setShowSettingsOverlay(false)}
      />
      <SemanticSearchOverlay
        visible={showSearchOverlay}
        blurTargetRef={blurTargetRef}
        onClose={() => setShowSearchOverlay(false)}
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
      <MomentCoverPicker
        visible={coverPickerMomentId !== null}
        blurTargetRef={blurTargetRef}
        momentName={coverPickerMoment?.name ?? 'Moment'}
        photos={coverPickerPhotos}
        selectedPhotoId={coverPickerCover?.photoId ?? null}
        onClose={() => setCoverPickerMomentId(null)}
        onSelect={(photoId) => {
          if (coverPickerMomentId) handleCoverSelected(coverPickerMomentId, photoId);
        }}
        isUploading={isUploadingCover}
        onUpload={() => {
          void handleCoverUpload();
        }}
      />
    </SafeAreaView>
  );
}

const NAV_CLEARANCE = 96;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
    paddingTop: 4,
    paddingBottom: 12,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
    letterSpacing: -0.4,
  },
  content: {
    flex: 1,
    paddingBottom: NAV_CLEARANCE,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: GRID_HORIZONTAL_PADDING,
    paddingBottom: 8,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
    justifyContent: 'flex-start',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: NAV_CLEARANCE,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
});
