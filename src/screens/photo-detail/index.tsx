import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/use-auth';
import { saveImageToGallery } from '@/lib/gallery';
import { deletePhoto } from '@/lib/photo-delete';
import { cacheRemotePhoto, resolvePhotoUri } from '@/lib/photo-cache';
import {
  canShareToInstagram,
  isInstagramSharePreviewMode,
  shareToInstagramStories,
} from '@/utils/share-to-instagram';

type ActionProps = {
  label: string;
  iosSymbol: 'square.and.arrow.up' | 'arrow.down.circle' | 'trash';
  androidSymbol: 'share' | 'download' | 'delete';
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

function PhotoAction({ label, iosSymbol, androidSymbol, onPress, disabled, destructive }: ActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionItem,
        disabled && styles.actionItemDisabled,
        pressed && !disabled && styles.actionItemPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <SymbolView
        name={{ ios: iosSymbol, android: androidSymbol }}
        size={24}
        tintColor={destructive ? '#ff6b6b' : '#fff'}
        weight="medium"
      />
      <Text style={[styles.actionLabel, destructive && styles.actionLabelDestructive]}>{label}</Text>
    </Pressable>
  );
}

export function PhotoDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id: momentId, photoId, storagePath, canDelete } = useLocalSearchParams<{
    id: string;
    photoId: string;
    storagePath?: string;
    canDelete?: string;
  }>();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const isSharePreview = isInstagramSharePreviewMode();
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const showDelete = canDelete === '1';
  const showShare = (canShare || isSharePreview) && !!imageUri;

  useEffect(() => {
    if (!momentId || !photoId) return;

    let cancelled = false;

    void (async () => {
      try {
        const uri = await resolvePhotoUri(photoId, momentId, storagePath);
        if (!cancelled) {
          setImageUri(uri);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Could not load photo');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [momentId, photoId, storagePath]);

  useEffect(() => {
    void canShareToInstagram().then(setCanShare);
  }, []);

  const handleShare = useCallback(async () => {
    if (!imageUri || isSharing) return;

    setIsSharing(true);
    try {
      await shareToInstagramStories(imageUri);
    } catch (err) {
      Alert.alert(
        'Could not share',
        err instanceof Error ? err.message : 'Something went wrong'
      );
    } finally {
      setIsSharing(false);
    }
  }, [imageUri, isSharing]);

  const handleSave = useCallback(async () => {
    if (!imageUri || isSaving) return;

    setIsSaving(true);
    try {
      let localUri = imageUri;

      if (!localUri.startsWith('file://') && !localUri.startsWith('/')) {
        if (!momentId || !photoId || !storagePath) {
          throw new Error('Photo is not available on this device yet');
        }

        const cached = await cacheRemotePhoto(photoId, momentId, storagePath);
        if (!cached) {
          throw new Error('Could not download photo');
        }
        localUri = cached;
      }

      await saveImageToGallery(localUri);
      Alert.alert('Saved', 'Photo saved to your camera roll.');
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Something went wrong'
      );
    } finally {
      setIsSaving(false);
    }
  }, [imageUri, isSaving, momentId, photoId, storagePath]);

  const handleDelete = useCallback(() => {
    if (!user || !momentId || !photoId || isDeleting) return;

    Alert.alert('Delete photo?', 'This removes the photo from the moment for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsDeleting(true);
            const result = await deletePhoto(user.id, momentId, photoId, storagePath);
            setIsDeleting(false);

            if (!result.ok) {
              Alert.alert('Could not delete', result.error);
              return;
            }

            void queryClient.invalidateQueries({ queryKey: ['photos', momentId] });
            router.back();
          })();
        },
      },
    ]);
  }, [user, momentId, photoId, storagePath, isDeleting, queryClient, router]);

  const showActionBar = !!imageUri;

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} contentFit="contain" />
      ) : loadError ? (
        <Text style={styles.errorText}>{loadError}</Text>
      ) : (
        <ActivityIndicator size="large" color="#fff" />
      )}

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeButton} hitSlop={8}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close' }}
            size={18}
            tintColor="#fff"
            weight="semibold"
          />
        </Pressable>
      </View>

      {showActionBar ? (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.actionRow}>
            {showShare ? (
              <PhotoAction
                label={isSharing ? 'Sharing…' : 'Share'}
                iosSymbol="square.and.arrow.up"
                androidSymbol="share"
                onPress={() => void handleShare()}
                disabled={isSharing}
              />
            ) : null}

            <PhotoAction
              label={isSaving ? 'Saving…' : 'Save'}
              iosSymbol="arrow.down.circle"
              androidSymbol="download"
              onPress={() => void handleSave()}
              disabled={isSaving}
            />

            {showDelete ? (
              <PhotoAction
                label={isDeleting ? 'Deleting…' : 'Delete'}
                iosSymbol="trash"
                androidSymbol="delete"
                onPress={handleDelete}
                disabled={isDeleting}
                destructive
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 18,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 36,
  },
  actionItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 64,
    paddingVertical: 4,
  },
  actionItemPressed: {
    opacity: 0.75,
  },
  actionItemDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 12,
    fontWeight: '500',
  },
  actionLabelDestructive: {
    color: '#ff8a84',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
