import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { SyncStatus } from '@/lib/queue';

type Props = {
  source: string;
  syncStatus: SyncStatus;
  isPicked?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
  onFailedPress?: () => void;
};

export function PhotoCell({
  source,
  syncStatus,
  isPicked = false,
  isSelected = false,
  onPress,
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
    onPress?.();
  }

  return (
    <Pressable onPress={handlePress} style={styles.cell}>
      <Image source={{ uri: source }} style={styles.image} />

      {isSelected && <View style={styles.selectedOverlay} />}

      {isSelected && (
        <View style={styles.checkBadge}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      )}

      {!isSelected && isPicked && (
        <View style={styles.pickedBadge}>
          <Text style={styles.badgeText}>🔖</Text>
        </View>
      )}

      {syncBadge && !isSelected && (
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
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
