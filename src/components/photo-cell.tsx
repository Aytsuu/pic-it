import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { SyncStatus } from '@/lib/queue';

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
      <Image source={{ uri: source }} style={styles.image} />

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
        <View style={styles.pickedBadge}>
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

const styles = StyleSheet.create({
  cell: { flex: 1, margin: 1, aspectRatio: 1, backgroundColor: '#111' },
  image: { ...StyleSheet.absoluteFill },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,122,255,0.3)',
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
