import { Platform } from 'react-native';

import { isOnnxRuntimeAvailable } from '@/lib/native-capabilities';

export async function embedImage(localUri: string): Promise<Float32Array> {
  if (Platform.OS === 'web') {
    const mod = await import('./embedder.web');
    return mod.embedImage(localUri);
  }

  if (!isOnnxRuntimeAvailable()) {
    const mod = await import('./embedder.stub');
    return mod.embedImage(localUri);
  }

  const mod = await import('./embedder.impl');
  return mod.embedImage(localUri);
}

export async function embedText(text: string): Promise<Float32Array> {
  if (Platform.OS === 'web') {
    const mod = await import('./embedder.web');
    return mod.embedText(text);
  }

  if (!isOnnxRuntimeAvailable()) {
    const mod = await import('./embedder.stub');
    return mod.embedText(text);
  }

  const mod = await import('./embedder.impl');
  return mod.embedText(text);
}
