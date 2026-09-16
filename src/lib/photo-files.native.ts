import * as FileSystem from 'expo-file-system/legacy';

export async function fileExists(localUri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(localUri);
  return info.exists;
}

export async function downloadPhotoToCache(
  url: string,
  photoId: string,
  momentId: string
): Promise<string> {
  const baseDir = FileSystem.cacheDirectory;
  if (!baseDir) throw new Error('Cache directory is unavailable');

  const dir = `${baseDir}photos/${momentId}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const dest = `${dir}${photoId}.jpg`;
  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) return dest;

  const result = await FileSystem.downloadAsync(url, dest);
  return result.uri;
}
