import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { isOnnxRuntimeAvailable } from '@/lib/native-capabilities';

const BASE_URL =
  'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/';
const MODEL_DIR = `${FileSystem.documentDirectory}models/`;

const MODEL_FILES = {
  vision: 'vision_model_quantized.onnx',
  text: 'text_model_quantized.onnx',
} as const;

type ModelName = keyof typeof MODEL_FILES;

const MODELS_READY_KEY = 'clip_models_ready';

const MIN_MODEL_BYTES: Record<ModelName, number> = {
  vision: 80 * 1024 * 1024,
  text: 60 * 1024 * 1024,
};

export type DownloadProgress = { downloaded: number; total: number; fraction: number };
export type ProgressCallback = (progress: DownloadProgress) => void;

export function getModelPath(name: ModelName): string {
  return MODEL_DIR + MODEL_FILES[name];
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }
}

async function downloadModel(name: ModelName, onProgress?: ProgressCallback): Promise<void> {
  const dest = getModelPath(name);
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return;

  const download = FileSystem.createDownloadResumable(
    BASE_URL + MODEL_FILES[name],
    dest,
    {},
    (progress) => {
      onProgress?.({
        downloaded: progress.totalBytesWritten,
        total: progress.totalBytesExpectedToWrite,
        fraction:
          progress.totalBytesWritten / (progress.totalBytesExpectedToWrite || 1),
      });
    }
  );

  const result = await download.downloadAsync();
  if (!result) throw new Error(`Failed to download ${MODEL_FILES[name]}`);
}

export async function ensureModelsReady(onProgress?: ProgressCallback): Promise<void> {
  if (!isOnnxRuntimeAvailable()) return;

  await ensureDir();
  await downloadModel('vision', onProgress);
  await downloadModel('text', onProgress);
  await AsyncStorage.setItem(MODELS_READY_KEY, '1');
}

async function isModelFileValid(name: ModelName): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(getModelPath(name));
  if (!info.exists || info.isDirectory) return false;
  if (typeof info.size === 'number' && info.size < MIN_MODEL_BYTES[name]) return false;
  return true;
}

export async function assertModelReady(name: ModelName): Promise<void> {
  const valid = await isModelFileValid(name);
  if (valid) return;

  await AsyncStorage.removeItem(MODELS_READY_KEY);
  throw new Error(
    `Search model "${MODEL_FILES[name]}" is missing or incomplete. Re-open the app on Wi-Fi to re-download.`
  );
}

export async function areModelsReady(): Promise<boolean> {
  if (!isOnnxRuntimeAvailable()) return true;

  const flag = await AsyncStorage.getItem(MODELS_READY_KEY);
  if (!flag) return false;

  const [visionOk, textOk] = await Promise.all([
    isModelFileValid('vision'),
    isModelFileValid('text'),
  ]);

  if (!visionOk || !textOk) {
    await AsyncStorage.removeItem(MODELS_READY_KEY);
    return false;
  }

  return true;
}
