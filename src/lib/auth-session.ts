import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

export const AUTH_REDIRECT_PATH = 'google-auth';

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
