import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useMemo, type RefObject } from 'react';
import {
  ActivityIndicator,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type View as RNView,
} from 'react-native';

import { BlurFormOverlay, BLUR_FORM_CONTENT_PADDING } from '@/components/blur-form-overlay';
import { getCoverStillPhotos, isSameCoverPhoto, type MomentPhoto } from '@/lib/moment-cover';
import { getPhotoDisplayUri } from '@/lib/photo-cache';

const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const GRID_MAX_HEIGHT = 280;
const INITIAL_DRAW_COUNT = 9;
const THUMB_SCALE = 0.36;

type Props = {
  visible: boolean;
  blurTargetRef: RefObject<RNView | null>;
  momentName: string;
  photos: MomentPhoto[];
  selectedPhotoId: string | null;
  isUploading?: boolean;
  onClose: () => void;
  onSelect: (photoId: string) => void;
  onUpload: () => void;
};

export function MomentCoverPicker({
  visible,
  blurTargetRef,
  momentName,
  photos,
  selectedPhotoId,
  isUploading = false,
  onClose,
  onSelect,
  onUpload,
}: Props) {
  const { width } = useWindowDimensions();
  const tileSize =
    (width - BLUR_FORM_CONTENT_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const fullPixelSize = Math.ceil(tileSize * PixelRatio.get());
  const thumbPixelSize = Math.max(32, Math.round(fullPixelSize * THUMB_SCALE));
  const stillPhotos = useMemo(() => getCoverStillPhotos(photos), [photos]);
  const listHeight = useMemo(() => {
    if (stillPhotos.length === 0) return 0;
    const rows = Math.ceil(stillPhotos.length / GRID_COLUMNS);
    return Math.min(GRID_MAX_HEIGHT, rows * tileSize + (rows - 1) * GRID_GAP);
  }, [stillPhotos.length, tileSize]);

  return (
    <BlurFormOverlay
      visible={visible}
      blurTargetRef={blurTargetRef}
      title="Choose cover"
      actionLabel=""
      onClose={onClose}
      onAction={onClose}
      hideHeaderActions
      freezeBlurOnOpen
    >
      <Text style={styles.momentName} numberOfLines={1}>
        {momentName}
      </Text>

      <View style={styles.container} collapsable={false}>
        {stillPhotos.length === 0 ? (
          <Text style={styles.empty}>No photos in this moment yet.</Text>
        ) : (
          <View style={[styles.imageLayer, { height: listHeight }]} collapsable={false}>
            <FlashList
              data={stillPhotos}
              numColumns={GRID_COLUMNS}
              style={styles.list}
              keyExtractor={(item) => item.id}
              extraData={selectedPhotoId}
              drawDistance={tileSize * 2}
              overrideProps={{ initialDrawBatchSize: INITIAL_DRAW_COUNT }}
              renderItem={({ item }) => (
                <CoverTile
                  uri={getPhotoDisplayUri(item.id, item.storage_path)}
                  selected={isSameCoverPhoto(item.id, selectedPhotoId)}
                  fullPixelSize={fullPixelSize}
                  thumbPixelSize={thumbPixelSize}
                  onPress={() => onSelect(item.id)}
                />
              )}
            />
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Uploads</Text>

      <View style={styles.container}>
        <Pressable
          onPress={onUpload}
          disabled={isUploading}
          style={({ pressed }) => [
            styles.uploadButton,
            pressed && styles.uploadButtonPressed,
            isUploading && styles.uploadButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Upload a cover from your library"
        >
          {isUploading ? (
            <ActivityIndicator />
          ) : (
            <SymbolView
              name={{ ios: 'photo.badge.plus', android: 'add_photo_alternate' }}
              size={22}
              tintColor="#111"
            />
          )}
          <Text style={styles.uploadButtonText}>
            {isUploading ? 'Uploading…' : 'Choose from library'}
          </Text>
        </Pressable>
      </View>
    </BlurFormOverlay>
  );
}

function CoverTile({
  uri,
  selected,
  fullPixelSize,
  thumbPixelSize,
  onPress,
}: {
  uri: string;
  selected: boolean;
  fullPixelSize: number;
  thumbPixelSize: number;
  onPress: () => void;
}) {
  const decodeSize = selected ? fullPixelSize : thumbPixelSize;

  return (
    <Pressable onPress={onPress} style={styles.tile}>
      <Image
        source={{ uri, width: decodeSize, height: decodeSize }}
        style={[styles.tileImage, !selected && styles.tileImageDimmed]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={`${uri}-${selected ? 'full' : 'thumb'}`}
        transition={0}
        allowDownscaling
      />
      {selected ? <View style={styles.tileSelected} pointerEvents="none" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  momentName: {
    fontSize: 15,
    color: 'rgba(60, 60, 67, 0.72)',
    marginBottom: 16,
  },
  container: {
    padding: 0,
  },
  imageLayer: {
    opacity: 0.99,
  },
  list: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(60, 60, 67, 0.72)',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 10,
  },
  empty: {
    fontSize: 16,
    color: 'rgba(60, 60, 67, 0.72)',
  },
  tile: {
    flex: 1,
    aspectRatio: 1,
    margin: GRID_GAP / 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e5e5ea',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileImageDimmed: {
    opacity: 0.42,
  },
  tileSelected: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
  },
  uploadButtonPressed: {
    opacity: 0.72,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
});
