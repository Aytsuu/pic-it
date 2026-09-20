import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';

export async function uploadPhoto(momentId: string, localUri: string): Promise<string> {
  const storagePath = `${momentId}/${randomUUID()}.jpg`;

  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (!fileInfo.exists) throw new Error(`File not found: ${localUri}`);

  const fileContent = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const buffer = Uint8Array.from(atob(fileContent), (c) => c.charCodeAt(0));

  const { error } = await supabase.storage
    .from('moment-photos')
    .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;

  return storagePath;
}

export async function deletePhotoFromStorage(storagePath: string): Promise<void> {
  const normalizedPath = storagePath.replace(/^\/+/, '');
  const { data, error } = await supabase.storage.from('moment-photos').remove([normalizedPath]);

  if (error) throw error;

  const deleted = data?.some((file) => file.name === normalizedPath) ?? false;
  if (!deleted) {
    throw new Error('Photo file could not be removed from storage');
  }
}
