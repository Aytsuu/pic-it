import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Button, Platform, Text, View } from 'react-native';

import {
  AUTH_REDIRECT_PATH,
  createSessionFromUrl,
  getAuthRedirectUri,
  getNativeAppRedirectUri,
} from '@/lib/auth-session';
import { getExpoAuthProxyRedirectUri, signInWithGoogleIdToken } from '@/lib/google-id-token-auth';
import { supabase } from '@/lib/supabase';

function getSupabaseHost(): string {
  try {
    return new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').host;
  } catch {
    return 'unknown';
  }
}

WebBrowser.maybeCompleteAuthSession();

export function SignInScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function handleDeepLink(url: string) {
      if (!url.includes(AUTH_REDIRECT_PATH)) return;

      try {
        setIsLoading(true);
        setError(null);
        await createSessionFromUrl(url);
        if (WebBrowser.dismissBrowser) {
          WebBrowser.dismissBrowser();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed');
      } finally {
        setIsLoading(false);
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) void handleDeepLink(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  async function signInWithGoogle() {
    setError(null);
    setIsLoading(true);

    try {
      if (Platform.OS === 'android') {
        await signInWithGoogleIdToken();
        return;
      }

      const redirectTo = getAuthRedirectUri();
      const nativeRedirect = getNativeAppRedirectUri();

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { skipBrowserRedirect: true, redirectTo },
      });

      if (oauthError || !data.url) {
        throw new Error(oauthError?.message ?? 'Could not start Google sign-in');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, nativeRedirect);

      if (result.type === 'success' && result.url) {
        await createSessionFromUrl(result.url);
        return;
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
        // Android often returns dismiss while the /google-auth deep link route finishes OAuth.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) return;
        return;
      }

      throw new Error('Google sign-in did not return a redirect URL');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <Button
        title={isLoading ? 'Signing in…' : 'Continue with Google'}
        onPress={signInWithGoogle}
        disabled={isLoading}
      />
      {error && <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>}
      {__DEV__ && (
        <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
          {Platform.OS === 'android'
            ? `Add BOTH of these in Google Cloud Console → Web client:\nRedirect: ${getExpoAuthProxyRedirectUri()}\nJS origin: https://auth.expo.io`
            : `Redirect: ${getAuthRedirectUri()}\nApp: ${getNativeAppRedirectUri()}`}
          {'\n'}
          Supabase: {getSupabaseHost()}
          {getSupabaseHost().includes('127.0.0.1') || getSupabaseHost().includes('localhost')
            ? '\n⚠ Use ngrok URL in EXPO_PUBLIC_SUPABASE_URL'
            : ''}
        </Text>
      )}
    </View>
  );
}
