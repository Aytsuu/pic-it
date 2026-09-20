import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { createSessionFromUrl } from '@/lib/auth-session';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function GoogleAuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        if (params.error) {
          throw new Error(params.error_description ?? params.error);
        }

        if (params.code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            params.code
          );
          if (exchangeError) throw exchangeError;
        } else {
          const initialUrl = await Linking.getInitialURL();
          if (!initialUrl) {
            throw new Error('No authorization code received');
          }
          await createSessionFromUrl(initialUrl);
        }

        if (WebBrowser.dismissBrowser) {
          WebBrowser.dismissBrowser();
        }

        router.replace('/(app)');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed');
        router.replace('/(auth)/sign-in');
      }
    })();
  }, [params.code, params.error, params.error_description, router]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 16, color: '#666' }}>Finishing sign-in…</Text>
    </View>
  );
}
