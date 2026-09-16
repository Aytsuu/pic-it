import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';

export async function uploadPhoto(momentId: string, localUri: string): Promise<string> {
  const storagePath = `${momentId}/${randomUUID()}.jpg`;

  const file = new File(localUri);
  if (!file.exists) throw new Error(`File not found: ${localUri}`);

  const buffer = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from('moment-photos')
    .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;

  return storagePath;
}
