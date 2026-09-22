import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { isVideoUri } from '@/lib/media-uri';
import { SyncStatus } from '@/lib/queue';
import { formatVideoDuration, getVideoDuration } from '@/lib/video-metadata';
import { getVideoThumbnailUri } from '@/lib/video-thumbnail';

type Props = {
  source: string;
  syncStatus: SyncStatus;
  isPicked?: boolean;
  isSelecting?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
  onDetailPress?: () => void;
  onFailedPress?: () => void;
};

export function PhotoCell({
  source,
  syncStatus,
  isPicked = false,
  isSelecting = false,
  isSelected = false,
  onPress,
  onDetailPress,
  onFailedPress,
}: Props) {
  const isVideo = isVideoUri(source);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [durationLabel, setDurationLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isVideo) {
      setThumbnailUri(null);
      setDurationLabel(null);
      return;
    }

    let cancelled = false;

    void getVideoThumbnailUri(source).then((uri) => {
      if (!cancelled) {
        setThumbnailUri(uri);
      }
    });

    void getVideoDuration(source).then((duration) => {
      if (!cancelled && duration !== null) {
        setDurationLabel(formatVideoDuration(duration));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isVideo, source]);

  const displayUri = isVideo ? thumbnailUri : source;

  const syncBadge =
    syncStatus === 'pending' || syncStatus === 'syncing'
      ? '⏳'
      : syncStatus === 'failed'
        ? '⚠️'
        : null;

  function handlePress() {
    if (syncStatus === 'failed') {
      onFailedPress?.();
      return;
    }
    if (onPress) {
      onPress();
      return;
    }
    onDetailPress?.();
  }

  return (
    <Pressable onPress={handlePress} style={styles.cell}>
      {displayUri ? (
        <Image source={{ uri: displayUri }} style={styles.image} />
      ) : (
        <View style={styles.placeholder} />
      )}

      {isVideo && !isSelecting ? (
        <View style={styles.playBadge}>
          <SymbolView
            name={{ ios: 'play.fill', android: 'play_arrow' }}
            size={18}
            tintColor="#fff"
            weight="semibold"
          />
        </View>
      ) : null}

      {isVideo && durationLabel ? (
        <View style={styles.durationBadge} pointerEvents="none">
          <Text style={styles.durationText}>{durationLabel}</Text>
        </View>
      ) : null}

      {isSelecting && isSelected && <View style={styles.selectedOverlay} />}

      {isSelecting && (
        isSelected ? (
          <View style={styles.checkBadge}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        ) : (
          <View style={styles.selectCircle} />
        )
      )}

      {!isSelecting && isPicked && (
        <View style={[styles.pickedBadge, isVideo && styles.pickedBadgeWithVideo]}>
          <Text style={styles.badgeText}>🔖</Text>
        </View>
      )}

      {syncBadge && !isSelecting && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{syncBadge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const CELL_RADIUS = 8;

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    margin: 1,
    aspectRatio: 1,
    backgroundColor: '#111',
    borderRadius: CELL_RADIUS,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
    borderRadius: CELL_RADIUS,
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#111',
    borderRadius: CELL_RADIUS,
  },
  playBadge: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,122,255,0.3)',
    borderRadius: CELL_RADIUS,
  },
  selectCircle: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  pickedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    padding: 2,
  },
  pickedBadgeWithVideo: {
    right: undefined,
    left: 4,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 2,
  },
  badgeText: { fontSize: 12 },
});
