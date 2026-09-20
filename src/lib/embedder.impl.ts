import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import * as ImageManipulator from 'expo-image-manipulator';
// @ts-expect-error upng-js has no bundled types
import UPNG from 'upng-js';

import { EOT_TOKEN_ID, tokenize } from '@/lib/clip-tokenizer';
import { formatSearchError, logSearchError, logSearchStep } from '@/lib/search-errors';
import { assertModelReady, getModelPath } from '@/lib/model-manager';

const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];
const IMAGE_SIZE = 224;
const EMBEDDING_DIM = 512;

let visionSession: InferenceSession | null = null;
let textSession: InferenceSession | null = null;

async function getVisionSession(): Promise<InferenceSession> {
  if (!visionSession) {
    await assertModelReady('vision');
    const path = getModelPath('vision');
    try {
      visionSession = await InferenceSession.create(path);
      if (__DEV__) {
        console.log('[embedder] vision inputs:', visionSession.inputNames);
        console.log('[embedder] vision outputs:', visionSession.outputNames);
      }
    } catch (err) {
      logSearchError('vision session create', err);
      throw new Error(`Vision model failed to load: ${formatSearchError(err)}`);
    }
  }
  return visionSession;
}

async function getTextSession(): Promise<InferenceSession> {
  if (!textSession) {
    await assertModelReady('text');
    const path = getModelPath('text');
    try {
      textSession = await InferenceSession.create(path);
      if (__DEV__) {
        console.log('[embedder] text inputs:', textSession.inputNames);
        console.log('[embedder] text outputs:', textSession.outputNames);
      }
    } catch (err) {
      logSearchError('text session create', err);
      throw new Error(`Text model failed to load: ${formatSearchError(err)}`);
    }
  }
  return textSession;
}

function decodePngToRgba(bytes: Uint8Array): Uint8Array {
  const decoded = UPNG.decode(bytes.buffer);
  const rgbaFrames = UPNG.toRGBA8(decoded);
  return new Uint8Array(rgbaFrames[0]);
}

async function buildPixelTensor(localUri: string): Promise<Tensor> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: IMAGE_SIZE, height: IMAGE_SIZE } }],
    { base64: true, format: ImageManipulator.SaveFormat.PNG }
  );

  if (!result.base64) throw new Error('Failed to read resized image');

  const pngBytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0));
  const pixels = decodePngToRgba(pngBytes);

  const data = new Float32Array(3 * IMAGE_SIZE * IMAGE_SIZE);
  for (let y = 0; y < IMAGE_SIZE; y++) {
    for (let x = 0; x < IMAGE_SIZE; x++) {
      const px = (y * IMAGE_SIZE + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const value = pixels[px + channel] / 255;
        data[channel * IMAGE_SIZE * IMAGE_SIZE + y * IMAGE_SIZE + x] =
          (value - MEAN[channel]) / STD[channel];
      }
    }
  }

  return new Tensor('float32', data, [1, 3, IMAGE_SIZE, IMAGE_SIZE]);
}

function createTokenTensor(values: number[]): Tensor {
  const shape = [1, values.length];

  if (typeof BigInt64Array !== 'undefined') {
    return new Tensor(
      'int64',
      BigInt64Array.from(values, (value) => BigInt(value)),
      shape
    );
  }

  return new Tensor('int64', values, shape);
}

function extractVector(data: Float32Array, dims: readonly number[], tokenIndex: number): Float32Array {
  if (dims.length === 2 && dims[1] === EMBEDDING_DIM) {
    return data.slice(0, EMBEDDING_DIM);
  }

  if (dims.length === 3 && dims[2] === EMBEDDING_DIM) {
    const seqLen = dims[1];
    const index = Math.min(Math.max(tokenIndex, 0), seqLen - 1);
    const offset = index * EMBEDDING_DIM;
    return data.slice(offset, offset + EMBEDDING_DIM);
  }

  if (data.length === EMBEDDING_DIM) return data;
  if (data.length > EMBEDDING_DIM) return data.slice(0, EMBEDDING_DIM);

  throw new Error(`Unexpected embedding shape: [${dims.join(', ')}]`);
}

function pickEmbedding(
  output: Record<string, Tensor>,
  tokenIds: number[],
  preferredKeys: string[]
): Float32Array {
  for (const key of preferredKeys) {
    const tensor = output[key];
    if (!tensor?.data) continue;

    const eotIndex = tokenIds.indexOf(EOT_TOKEN_ID);
    const tokenIndex = eotIndex >= 0 ? eotIndex : tokenIds.findLastIndex((id) => id > 0);

    return extractVector(tensor.data as Float32Array, tensor.dims, tokenIndex);
  }

  const firstKey = Object.keys(output)[0];
  const tensor = firstKey ? output[firstKey] : undefined;
  if (!tensor?.data) {
    throw new Error('ONNX session returned no embedding output');
  }

  const eotIndex = tokenIds.indexOf(EOT_TOKEN_ID);
  const tokenIndex = eotIndex >= 0 ? eotIndex : tokenIds.findLastIndex((id) => id > 0);
  return extractVector(tensor.data as Float32Array, tensor.dims, tokenIndex);
}

function normaliseL2(vec: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;

  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

export async function embedImage(localUri: string): Promise<Float32Array> {
  const session = await getVisionSession();
  const pixelTensor = await buildPixelTensor(localUri);

  try {
    const feeds: Record<string, Tensor> = {};
    const inputName = session.inputNames.includes('pixel_values')
      ? 'pixel_values'
      : session.inputNames[0];
    feeds[inputName] = pixelTensor;

    const output = await session.run(feeds);
    return normaliseL2(
      pickEmbedding(output, [], ['image_embeds', 'pooler_output', 'last_hidden_state'])
    );
  } catch (err) {
    logSearchError('vision inference', err);
    throw new Error(`Image embedding failed: ${formatSearchError(err)}`);
  }
}

export async function embedText(text: string): Promise<Float32Array> {
  const session = await getTextSession();
  const tokenIds = tokenize(text);
  const attentionMask = tokenIds.map((id) => (id > 0 ? 1 : 0));

  logSearchStep('embed:text:run', {
    tokenCount: tokenIds.filter((id) => id > 0).length,
    inputs: session.inputNames,
  });

  try {
    const feeds: Record<string, Tensor> = {};
    if (session.inputNames.includes('input_ids')) {
      feeds.input_ids = createTokenTensor(tokenIds);
    }
    if (session.inputNames.includes('attention_mask')) {
      feeds.attention_mask = createTokenTensor(attentionMask);
    }

    if (Object.keys(feeds).length === 0) {
      feeds[session.inputNames[0]] = createTokenTensor(tokenIds);
    }

    const output = await session.run(feeds);
    const vec = normaliseL2(
      pickEmbedding(output, tokenIds, ['text_embeds', 'pooler_output', 'last_hidden_state'])
    );
    logSearchStep('embed:text:ok', { dims: vec.length });
    return vec;
  } catch (err) {
    logSearchError('text inference', err);
    throw new Error(`Text embedding failed: ${formatSearchError(err)}`);
  }
}
