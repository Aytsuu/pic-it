import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export function isOnnxRuntimeAvailable(): boolean {
  return Platform.OS !== 'web' && NativeModules.Onnxruntime != null;
}

export function isRnShareAvailable(): boolean {
  return TurboModuleRegistry.get('RNShare') != null;
}

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** Semantic search UI can render in Expo Go; inference needs a dev build. */
export function isSemanticSearchPreviewMode(): boolean {
  return !isOnnxRuntimeAvailable();
}

/** Instagram share button can render in Expo Go; sharing needs a dev build. */
export function isInstagramSharePreviewMode(): boolean {
  return Platform.OS !== 'web' && !isRnShareAvailable();
}
