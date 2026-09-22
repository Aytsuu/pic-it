import * as VideoThumbnails from 'expo-video-thumbnails';

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

export async function getVideoThumbnailUri(videoUri: string): Promise<string | null> {
  const cached = cache.get(videoUri);
  if (cached) return cached;

  const pending = inFlight.get(videoUri);
  if (pending) return pending;

  const request = VideoThumbnails.getThumbnailAsync(videoUri, { time: 0 })
    .then(({ uri }) => {
      cache.set(videoUri, uri);
      inFlight.delete(videoUri);
      return uri;
    })
    .catch(() => {
      inFlight.delete(videoUri);
      return null;
    });

  inFlight.set(videoUri, request);
  return request;
}
