export async function fileExists(_localUri: string): Promise<boolean> {
  return false;
}

export async function downloadPhotoToCache(
  _url: string,
  _photoId: string,
  _momentId: string
): Promise<string> {
  throw new Error('Photo download is not supported on web');
}

export async function deleteLocalFile(_localUri: string): Promise<void> {}

export function getCachedPhotoPath(_momentId: string, _photoId: string): string {
  return '';
}

export async function deleteCachedPhotoFile(_momentId: string, _photoId: string): Promise<void> {}
