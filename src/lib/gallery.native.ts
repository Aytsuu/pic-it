import { createAssetAsync, requestPermissionsAsync } from 'expo-media-library/legacy';

export async function saveImageToGallery(localUri: string): Promise<void> {
  const { status } = await requestPermissionsAsync(true);
  if (status !== 'granted') {
    throw new Error('Media library permission denied');
  }

  await createAssetAsync(localUri);
}
