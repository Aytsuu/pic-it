import { createVideoPlayer } from 'expo-video';

const durationCache = new Map<string, number>();
const durationInFlight = new Map<string, Promise<number | null>>();

export function formatVideoDuration(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export async function getVideoDuration(videoUri: string): Promise<number | null> {
  const cached = durationCache.get(videoUri);
  if (cached !== undefined) return cached;

  const pending = durationInFlight.get(videoUri);
  if (pending) return pending;

  const request = new Promise<number | null>((resolve) => {
    const player = createVideoPlayer(videoUri);
    let settled = false;

    const finalize = (duration: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      sourceLoadSubscription.remove();
      statusSubscription.remove();
      player.release();
      durationInFlight.delete(videoUri);

      if (duration !== null && duration > 0) {
        durationCache.set(videoUri, duration);
        resolve(duration);
        return;
      }

      resolve(null);
    };

    const sourceLoadSubscription = player.addListener('sourceLoad', ({ duration }) => {
      finalize(duration > 0 ? duration : null);
    });

    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') {
        finalize(null);
      }
    });

    const timeout = setTimeout(() => {
      finalize(player.duration > 0 ? player.duration : null);
    }, 12_000);
  });

  durationInFlight.set(videoUri, request);
  return request;
}
