import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';

import type { Session } from '@supabase/supabase-js';
import { AuthError } from '@supabase/supabase-js';

import { isOnline } from '@/lib/network';
import { supabase } from '@/lib/supabase';

export const AUTH_REDIRECT_PATH = 'google-auth';

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
 * Expo Go must use exp+<slug>:// (e.g. exp+pic-it://google-auth).
 * The exp://<host>:8081/--/path form is for in-app routing, not OAuth callbacks —
 * Safari cannot open it after Google sign-in.
 * Dev/production builds use picit:// from app.json.
 */
export function getAuthRedirectUri(): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    const slug = Constants.expoConfig?.slug ?? 'pic-it';
    return `exp+${slug}://${AUTH_REDIRECT_PATH}`;
  }

  return Linking.createURL(AUTH_REDIRECT_PATH, { scheme: 'picit' });
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
