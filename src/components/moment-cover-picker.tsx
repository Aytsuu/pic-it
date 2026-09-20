import { Image } from 'expo-image';
import { useMemo, type RefObject } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type View as RNView,
} from 'react-native';

import { BlurFormOverlay } from '@/components/blur-form-overlay';
import { getPhotoDisplayUri } from '@/lib/photo-cache';
import type { MomentPhoto } from '@/lib/moment-cover';

type Props = {
  visible: boolean;
  blurTargetRef: RefObject<RNView | null>;
  momentName: string;
  photos: MomentPhoto[];
  selectedPhotoId: string | null;
  onClose: () => void;
  onSelect: (photoId: string) => void;
};

export function MomentCoverPicker({
  visible,
  blurTargetRef,
  momentName,
  photos,
  selectedPhotoId,
  onClose,
  onSelect,
}: Props) {
  const { width } = useWindowDimensions();
  const tileSize = useMemo(() => (width - 40 - 16) / 3, [width]);

  return (
    <BlurFormOverlay
      visible={visible}
      blurTargetRef={blurTargetRef}
      title="Choose cover"
      actionLabel=""
      onClose={onClose}
      onAction={onClose}
      hideHeaderActions
    >
      <Text style={styles.subtitle} numberOfLines={1}>{momentName}</Text>

      {photos.length === 0 ? (
        <Text style={styles.empty}>No photos in this moment yet.</Text>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          numColumns={3}
          scrollEnabled={photos.length > 9}
          style={styles.list}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedPhotoId;

            return (
              <Pressable
                onPress={() => onSelect(item.id)}
                style={[
                  styles.tile,
                  { width: tileSize, height: tileSize },
                  isSelected && styles.tileSelected,
                ]}
              >
                <Image
                  source={{ uri: getPhotoDisplayUri(item.id, item.storage_path) }}
                  style={styles.tileImage}
                  contentFit="cover"
                />
              </Pressable>
            );
          }}
        />
      )}
    </BlurFormOverlay>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: 15,
    color: 'rgba(60, 60, 67, 0.72)',
    marginBottom: 16,
  },
  empty: {
    fontSize: 16,
    color: 'rgba(60, 60, 67, 0.72)',
  },
  list: {
    maxHeight: 360,
  },
  listContent: {
    paddingBottom: 12,
  },
  row: {
    gap: 8,
    marginBottom: 8,
  },
  tile: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e5e5ea',
  },
  tileSelected: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
});
