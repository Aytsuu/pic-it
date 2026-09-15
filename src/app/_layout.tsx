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
  const { session } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const group = segments[0] as string | undefined;

  useEffect(() => {
    const inAuth = group === '(auth)';
    const inApp = group === '(app)';

    if (!session && !inAuth) {
      router.replace(SIGN_IN_ROUTE);
    }

    if (session && inAuth) {
      router.replace(APP_ROUTE);
    }

    if (session && !inAuth && !inApp) {
      router.replace(APP_ROUTE);
    }
  }, [session, group, router]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionGate />
    </QueryClientProvider>
  );
}
