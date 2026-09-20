import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/hooks/use-auth';
import { deletePhoto } from '@/lib/photo-delete';
import { resolvePhotoUri } from '@/lib/photo-cache';
import { canShareToInstagram, shareToInstagramStories } from '@/utils/share-to-instagram';

export function PhotoDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const showDelete = canDelete === '1';

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

  return (
    <View style={styles.container}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} contentFit="contain" />
      ) : loadError ? (
        <Text style={styles.errorText}>{loadError}</Text>
      ) : (
        <ActivityIndicator size="large" color="#fff" />
      )}

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Close</Text>
        </Pressable>

        <View style={styles.headerActions}>
          {showDelete && (
            <Pressable
              onPress={handleDelete}
              disabled={isDeleting}
              style={[styles.headerButton, styles.deleteButton, isDeleting && styles.disabled]}
            >
              <Text style={styles.headerButtonText}>{isDeleting ? 'Deleting…' : 'Delete'}</Text>
            </Pressable>
          )}

          {canShare && imageUri && (
            <Pressable
              onPress={() => void handleShare()}
              disabled={isSharing}
              style={[styles.headerButton, styles.shareButton, isSharing && styles.disabled]}
            >
              <Text style={styles.headerButtonText}>{isSharing ? 'Sharing…' : 'Share'}</Text>
            </Pressable>
          )}
        </View>
      </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 48,
    paddingHorizontal: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  shareButton: {
    backgroundColor: 'rgba(32,138,239,0.85)',
  },
  deleteButton: {
    backgroundColor: 'rgba(255,59,48,0.9)',
  },
  disabled: {
    opacity: 0.6,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
});
