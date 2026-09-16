import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { SyncStatus } from '@/lib/queue';

type Props = {
  source: string;
  syncStatus: SyncStatus;
  onFailedPress?: () => void;
};

export function PhotoCell({ source, syncStatus, onFailedPress }: Props) {
  const badge =
    syncStatus === 'pending' || syncStatus === 'syncing'
      ? '⏳'
      : syncStatus === 'failed'
        ? '⚠️'
        : null;

  return (
    <Pressable
      onPress={syncStatus === 'failed' ? onFailedPress : undefined}
      style={styles.cell}
    >
      <Image source={{ uri: source }} style={styles.image} />
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, margin: 1, aspectRatio: 1, backgroundColor: '#111' },
  image: { ...StyleSheet.absoluteFill },
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
