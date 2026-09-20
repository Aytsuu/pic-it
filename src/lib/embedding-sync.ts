import { listUnsynced, markSyncedEmbeddings } from '@/lib/embedding-store';
import { supabase } from '@/lib/supabase';

const BATCH_SIZE = 20;

export async function syncEmbeddings(): Promise<void> {
  const pending = listUnsynced();
  if (pending.length === 0) return;

  for (let index = 0; index < pending.length; index += BATCH_SIZE) {
    const batch = pending.slice(index, index + BATCH_SIZE);

    for (const { photoId, embedding } of batch) {
      const { error } = await supabase
        .from('photos')
        .update({ embedding: Array.from(embedding) })
        .eq('id', photoId);

      if (!error) {
        markSyncedEmbeddings([photoId]);
      }
    }
  }
}
