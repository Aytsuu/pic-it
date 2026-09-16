import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';

import {
  AUTH_REDIRECT_PATH,
  createSessionFromUrl,
  getAuthRedirectUri,
} from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';

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
      const redirectTo = getAuthRedirectUri();

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { skipBrowserRedirect: true, redirectTo },
      });

      if (oauthError || !data.url) {
        throw new Error(oauthError?.message ?? 'Could not start Google sign-in');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        await createSessionFromUrl(result.url);
        return;
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
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
          Redirect: {getAuthRedirectUri()}
        </Text>
      )}
    </View>
  );
}
