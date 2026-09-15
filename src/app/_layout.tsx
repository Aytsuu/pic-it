import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Href, Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient();

void supabase;

const SIGN_IN_ROUTE = '/(auth)/sign-in' as Href;
const APP_ROUTE = '/(app)' as Href;

function SessionGate() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (session && inAuthGroup) {
      router.replace(APP_ROUTE);
    } else if (!session && !inAuthGroup) {
      router.replace(SIGN_IN_ROUTE);
    }
  }, [session, isLoading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionGate />
    </QueryClientProvider>
  );
}
