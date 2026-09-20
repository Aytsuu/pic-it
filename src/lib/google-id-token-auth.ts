import { AuthRequest, Prompt, ResponseType } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { discovery } from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

import { getNativeAppRedirectUri } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';

export function getExpoAuthProxyRedirectUri(): string {
  const owner = Constants.expoConfig?.owner ?? 'aytsuu';
  const slug = Constants.expoConfig?.slug ?? 'pic-it';
  const fullName = Constants.expoConfig?.originalFullName ?? `@${owner}/${slug}`;
  return `https://auth.expo.io/${fullName}`;
}

function getGoogleWebClientId(): string {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID. Add your Google Web client ID to .env.local'
    );
  }
  return clientId;
}

function missingRedirectUriMessage(proxyRedirect: string): string {
  return (
    'Google blocked this request. In Google Cloud Console → Credentials → your Web client, add:\n\n' +
    `Authorized redirect URIs:\n${proxyRedirect}\n\n` +
    'Authorized JavaScript origins:\nhttps://auth.expo.io'
  );
}

/**
 * Android Chrome + free ngrok blocks the Supabase OAuth callback (ERR_NGROK_6024).
 * Use Google's authorization-code flow via Expo's HTTPS proxy, exchange the code
 * on the server, then create a Supabase session from the id_token.
 */
export async function signInWithGoogleIdToken(): Promise<void> {
  const proxyRedirect = getExpoAuthProxyRedirectUri();
  const nativeReturn = getNativeAppRedirectUri();
  const clientId = getGoogleWebClientId();

  const request = new AuthRequest({
    clientId,
    redirectUri: proxyRedirect,
    responseType: ResponseType.Code,
    usePKCE: true,
    scopes: ['openid', 'profile', 'email'],
    prompt: Prompt.SelectAccount,
  });

  const googleAuthUrl = await request.makeAuthUrlAsync(discovery);
  const proxyStartUrl =
    `${proxyRedirect}/start?` +
    new URLSearchParams({
      authUrl: googleAuthUrl,
      returnUrl: nativeReturn,
    }).toString();

  const result = await WebBrowser.openAuthSessionAsync(proxyStartUrl, nativeReturn);

  if (result.type !== 'success' || !result.url) {
    if (result.type === 'cancel' || result.type === 'dismiss') return;
    throw new Error('Google sign-in did not complete');
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode || params.error) {
    const description = params.error_description ?? params.error ?? errorCode ?? '';
    if (description.includes('invalid') || params.error === 'invalid_request') {
      throw new Error(missingRedirectUriMessage(proxyRedirect));
    }
    throw new Error(params.error_description ?? params.error ?? errorCode ?? 'Google sign-in failed');
  }

  const code = params.code;
  if (!code) {
    throw new Error(missingRedirectUriMessage(proxyRedirect));
  }

  const { data, error: exchangeError } = await supabase.functions.invoke('google-oauth-exchange', {
    body: {
      code,
      codeVerifier: request.codeVerifier,
      redirectUri: proxyRedirect,
    },
  });

  if (exchangeError) throw exchangeError;
  if (data?.error) throw new Error(data.error);

  const idToken = data?.id_token as string | undefined;
  if (!idToken) {
    throw new Error('Google token exchange did not return an id_token');
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) throw error;
}
