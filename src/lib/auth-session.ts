import { makeRedirectUri } from 'expo-auth-session';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { Platform } from 'react-native';

import type { Session } from '@supabase/supabase-js';
import { AuthError } from '@supabase/supabase-js';

import { isOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';

export const AUTH_REDIRECT_PATH = 'google-auth';

/** Deep link that Expo Go / the dev build actually opens. */
export function getNativeAppRedirectUri(): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    if (Platform.OS === 'android') {
      return makeRedirectUri({ path: AUTH_REDIRECT_PATH });
    }

    const slug = Constants.expoConfig?.slug ?? 'pic-it';
    return `exp+${slug}://${AUTH_REDIRECT_PATH}`;
  }

  return makeRedirectUri({
    scheme: 'picit',
    path: AUTH_REDIRECT_PATH,
  });
}

function isInvalidSessionError(error: AuthError): boolean {
  if (error.status === 401 || error.status === 403) return true;

  const message = error.message.toLowerCase();
  return (
    message.includes('invalid jwt') ||
    message.includes('jwt expired') ||
    message.includes('session not found') ||
    message.includes('user not found')
  );
}

/**
 * Offline-first session check: trust the local session when offline.
 * When online, verify with the server and only sign out on definitive auth failures.
 */
export async function validateStoredSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  if (!(await isOnline())) return session;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error instanceof AuthError && isInvalidSessionError(error)) {
      await supabase.auth.signOut();
      return null;
    }
    return session;
  }

  if (!user) {
    await supabase.auth.signOut();
    return null;
  }

  return session;
}

/**
 * URL sent to Supabase as `redirectTo`.
 * Android Expo Go cannot follow Google/ngrok HTTPS → exp://192.168.x.x (Chrome blocks it),
 * so we bounce through an HTTPS edge function first.
 */
export function getAuthRedirectUri(): string {
  const appUri = getNativeAppRedirectUri();

  if (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient &&
    Platform.OS === 'android'
  ) {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      return `${supabaseUrl}/functions/v1/oauth-return?app=${encodeURIComponent(appUri)}`;
    }
  }

  return appUri;
}

export async function createSessionFromUrl(url: string): Promise<void> {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  const { access_token, refresh_token, code } = params;

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    if (error) throw error;
    return;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  throw new Error('No auth credentials found in redirect URL');
}
