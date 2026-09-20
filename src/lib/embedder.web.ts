export async function embedImage(_uri: string): Promise<Float32Array> {
  throw new Error('Image embedding is not supported on web');
}

export async function embedText(_text: string): Promise<Float32Array> {
  throw new Error('Text embedding is not supported on web');
}
