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
