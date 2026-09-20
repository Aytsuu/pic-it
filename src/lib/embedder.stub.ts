const EXPO_GO_MESSAGE =
  'Semantic search requires a development build. UI preview is available in Expo Go.';

export async function embedImage(_localUri: string): Promise<Float32Array> {
  throw new Error(EXPO_GO_MESSAGE);
}

export async function embedText(_text: string): Promise<Float32Array> {
  throw new Error(EXPO_GO_MESSAGE);
}
