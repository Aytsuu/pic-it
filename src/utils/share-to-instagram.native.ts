import { Linking, Platform } from 'react-native';
import type { ShareSingleOptions } from 'react-native-share';

import {
  isInstagramSharePreviewMode as isPreviewMode,
  isRnShareAvailable,
} from '@/lib/native-capabilities';

const EXPO_GO_SHARE_MESSAGE =
  'Sharing requires a development build. Expo Go does not include the native share module.';

export function isInstagramSharePreviewMode(): boolean {
  return isPreviewMode();
}

export async function canShareToInstagram(): Promise<boolean> {
  if (!isRnShareAvailable()) return false;

  try {
    if (Platform.OS === 'android') {
      const Share = (await import('react-native-share')).default;
      const result = await Share.isPackageInstalled('com.instagram.android');
      return result.isInstalled;
    }

    if (Platform.OS === 'ios') {
      return Linking.canOpenURL('instagram-stories://share');
    }

    return false;
  } catch {
    return false;
  }
}

export async function shareToInstagramStories(localUri: string): Promise<void> {
  if (!isRnShareAvailable()) {
    throw new Error(EXPO_GO_SHARE_MESSAGE);
  }

  try {
    const { default: Share, Social } = await import('react-native-share');
    const options: ShareSingleOptions = {
      backgroundImage: localUri,
      social: Social.InstagramStories,
      appId: process.env.EXPO_PUBLIC_FB_APP_ID ?? '',
    };
    await Share.shareSingle(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('TurboModuleRegistry') ||
      message.includes('Native module') ||
      message.includes('RNShare')
    ) {
      throw new Error(EXPO_GO_SHARE_MESSAGE);
    }
    throw err;
  }
}
