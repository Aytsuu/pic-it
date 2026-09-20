import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getPhotoDisplayUri } from '@/lib/photo-cache';
import { formatMomentDate } from '@/utils/format-moment-date';

type Props = {
  name: string;
  createdAt: string;
  photoId: string | null;
  storagePath: string | null;
  onPress: () => void;
  onLongPress?: () => void;
};

export function MomentGridCard({
  name,
  createdAt,
  photoId,
  storagePath,
  onPress,
  onLongPress,
}: Props) {
  const imageUri =
    photoId && storagePath ? getPhotoDisplayUri(photoId, storagePath) : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={320}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatMomentDate(createdAt)}`}
      accessibilityHint="Long press to change cover photo"
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={styles.placeholder}>
          <SymbolView
            name={{ ios: 'photo.on.rectangle.angled', android: 'photo_library' }}
            size={28}
            tintColor="rgba(255,255,255,0.55)"
          />
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <Text style={styles.date}>{formatMomentDate(createdAt)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1c1c1e',
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2c2c2e',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  date: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    marginTop: 4,
  },
});
